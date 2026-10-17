import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useNoteAutosave from './useNoteAutosave';
import client from '../../../api/client';

vi.mock('../../../api/client', () => ({
  default: { put: vi.fn() },
}));

const makeEditor = (json, text) => ({
  getJSON: () => json,
  getText: () => text,
  commands: { setContent: vi.fn() },
  // syncEditor가 BlockId 점검 트랜잭션을 dispatch한다.
  state: { tr: { setMeta() { return this; } } },
  view: { dispatch: vi.fn() },
});

describe('useNoteAutosave', () => {
  beforeEach(() => {
    localStorage.clear();
    client.put.mockReset();
    client.put.mockResolvedValue({ data: {} });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getInitialContent', () => {
    it('서버 데이터가 없고 로컬 저장 데이터도 없으면 제목만 있는 빈 문서를 반환한다', () => {
      const { result } = renderHook(() =>
        useNoteAutosave({ noteId: 1, initialData: { title: '내 노트', content: null } })
      );

      const doc = result.current.getInitialContent();

      expect(doc.type).toBe('doc');
      expect(doc.content[0].content[0].text).toBe('내 노트');
    });

    it('유효한 서버 콘텐츠가 있으면 그대로 사용한다', () => {
      const serverDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
      const { result } = renderHook(() =>
        useNoteAutosave({
          noteId: 1,
          initialData: { title: '제목', content: JSON.stringify(serverDoc), updatedAt: 100 },
        })
      );

      expect(result.current.getInitialContent()).toEqual(serverDoc);
    });

    // 실제 API의 updatedAt은 LocalDateTime ISO 문자열이다.
    const SERVER_V1 = '2026-10-17T21:30:57.282749';
    const SERVER_V2 = '2026-10-17T21:35:00.000001';
    const serverDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
    const localDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '임시 저장분' }] }] };
    const openWith = (updatedAt) => renderHook(() =>
      useNoteAutosave({ noteId: 1, initialData: { title: '제목', content: JSON.stringify(serverDoc), updatedAt } })
    );

    it('서버에 저장되지 않은 백업이 지금 서버 버전 위의 편집이면 복구한다', () => {
      localStorage.setItem('note-temp-1', JSON.stringify({ content: localDoc, timestamp: 1, baseUpdatedAt: SERVER_V1 }));

      expect(openWith(SERVER_V1).result.current.getInitialContent()).toEqual(localDoc);
    });

    it('그 사이 다른 곳에서 서버 내용이 바뀌었으면 서버 내용을 쓴다', () => {
      localStorage.setItem('note-temp-1', JSON.stringify({ content: localDoc, timestamp: Date.now(), baseUpdatedAt: SERVER_V1 }));

      expect(openWith(SERVER_V2).result.current.getInitialContent()).toEqual(serverDoc);
    });

    it('기준 버전이 없는 옛 형식 백업은 서버 내용이 있으면 쓰지 않는다', () => {
      localStorage.setItem('note-temp-1', JSON.stringify({ content: localDoc, timestamp: Date.now() }));

      expect(openWith(SERVER_V1).result.current.getInitialContent()).toEqual(serverDoc);
    });

    it('localStorage에 손상된 JSON이 있어도 예외 없이 서버 데이터로 폴백한다', () => {
      const serverDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
      localStorage.setItem('note-temp-1', '{ 손상된 json');

      const { result } = renderHook(() =>
        useNoteAutosave({
          noteId: 1,
          initialData: { title: '제목', content: JSON.stringify(serverDoc), updatedAt: 100 },
        })
      );

      expect(() => result.current.getInitialContent()).not.toThrow();
      expect(result.current.getInitialContent()).toEqual(serverDoc);
    });
  });

  describe('handleEditorUpdate', () => {
    it('localStorage 기록은 300ms debounce되어 마지막 호출 내용만 저장된다', () => {
      const { result } = renderHook(() => useNoteAutosave({ noteId: 5, initialData: {} }));
      const editor1 = makeEditor({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'A' }] }] }, 'A');
      const editor2 = makeEditor({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'AB' }] }] }, 'AB');

      act(() => {
        result.current.handleEditorUpdate(editor1);
        vi.advanceTimersByTime(100);
        result.current.handleEditorUpdate(editor2);
      });

      expect(localStorage.getItem('note-temp-5')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      const saved = JSON.parse(localStorage.getItem('note-temp-5'));
      expect(saved.content.content[0].content[0].text).toBe('AB');
    });

    it('최초 마운트 상태(syncEditor 호출 전)에서는 서버 저장을 트리거하지 않는다', () => {
      const { result } = renderHook(() => useNoteAutosave({ noteId: 5, initialData: {} }));
      const editor = makeEditor({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: '제목' }] }] }, '제목');

      act(() => {
        result.current.handleEditorUpdate(editor);
        vi.advanceTimersByTime(2000);
      });

      expect(client.put).not.toHaveBeenCalled();
    });

    it('syncEditor 이후에는 2000ms debounce 뒤 서버에 저장한다', async () => {
      const { result } = renderHook(() => useNoteAutosave({ noteId: 5, initialData: { title: '제목' } }));
      const initialEditor = makeEditor({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: '제목' }] }] }, '제목');

      act(() => {
        result.current.syncEditor(initialEditor);
      });

      const updatedEditor = makeEditor(
        { type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: '제목' }] }, { type: 'paragraph', content: [{ type: 'text', text: '본문' }] }] },
        '제목본문'
      );

      await act(async () => {
        result.current.handleEditorUpdate(updatedEditor);
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(client.put).toHaveBeenCalledWith(
        '/notes/5',
        expect.objectContaining({ title: '제목' }),
        expect.anything()
      );
    });
  });

  describe('로컬 백업과 서버 버전', () => {
    const heading = { type: 'heading', content: [{ type: 'text', text: '제목' }] };
    const serverDoc = { type: 'doc', content: [heading] };
    const editedDoc = { type: 'doc', content: [heading, { type: 'paragraph', content: [{ type: 'text', text: '본문' }] }] };
    const initialData = { title: '제목', content: JSON.stringify(serverDoc), updatedAt: '2026-10-17T21:30:57.1' };

    it('복구한 백업은 서버와 다르므로 열자마자 저장을 예약한다', async () => {
      localStorage.setItem('note-temp-7', JSON.stringify({ content: editedDoc, timestamp: 1, baseUpdatedAt: initialData.updatedAt }));
      const { result } = renderHook(() => useNoteAutosave({ noteId: 7, initialData }));

      act(() => {
        result.current.syncEditor(makeEditor(editedDoc, '제목본문'));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(client.put).toHaveBeenCalledTimes(1);
      expect(JSON.parse(client.put.mock.calls[0][1].content)).toEqual(editedDoc);
    });

    it('저장에 성공하면 같은 내용의 백업을 지우고, 다음 백업은 응답 updatedAt을 기준 버전으로 쓴다', async () => {
      client.put.mockResolvedValue({ data: { updatedAt: '2026-10-17T21:31:00.2' } });
      const { result } = renderHook(() => useNoteAutosave({ noteId: 7, initialData }));
      act(() => {
        result.current.syncEditor(makeEditor(serverDoc, '제목'));
      });

      await act(async () => {
        result.current.handleEditorUpdate(makeEditor(editedDoc, '제목본문'));
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(JSON.parse(localStorage.getItem('note-temp-7')).baseUpdatedAt).toBe('2026-10-17T21:30:57.1');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1700);
      });
      expect(localStorage.getItem('note-temp-7')).toBeNull();

      const moreDoc = { type: 'doc', content: [...editedDoc.content, { type: 'paragraph', content: [{ type: 'text', text: '더' }] }] };
      await act(async () => {
        result.current.handleEditorUpdate(makeEditor(moreDoc, '제목본문더'));
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(JSON.parse(localStorage.getItem('note-temp-7')).baseUpdatedAt).toBe('2026-10-17T21:31:00.2');
    });

    it('저장에 실패하면 백업을 남긴다', async () => {
      client.put.mockRejectedValue(new Error('network'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHook(() => useNoteAutosave({ noteId: 7, initialData }));
      act(() => {
        result.current.syncEditor(makeEditor(serverDoc, '제목'));
      });

      await act(async () => {
        result.current.handleEditorUpdate(makeEditor(editedDoc, '제목본문'));
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(result.current.saveStatus).toBe('error');
      expect(JSON.parse(localStorage.getItem('note-temp-7')).content).toEqual(editedDoc);
    });
  });

  describe('cancelPendingSave', () => {
    it('대기 중인 서버 저장과 localStorage 저장을 모두 취소한다', () => {
      const { result } = renderHook(() => useNoteAutosave({ noteId: 5, initialData: { title: '제목' } }));
      const initialEditor = makeEditor({ type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: '제목' }] }] }, '제목');

      act(() => {
        result.current.syncEditor(initialEditor);
        result.current.handleEditorUpdate(initialEditor);
        result.current.cancelPendingSave();
        vi.advanceTimersByTime(2000);
      });

      expect(client.put).not.toHaveBeenCalled();
      expect(localStorage.getItem('note-temp-5')).toBeNull();
    });
  });

  describe('BlockId 수리 저장', () => {
    const paragraph = (id) => ({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text: id }] });
    const serverDoc = { type: 'doc', content: [paragraph('dup'), paragraph('dup')] };
    const repairedDoc = { type: 'doc', content: [paragraph('dup'), paragraph('new')] };
    const initialData = { title: '제목', content: JSON.stringify(serverDoc), updatedAt: 100 };

    it('열면서 고친 id는 StrictMode처럼 정리 후 재실행돼도 서버에 저장된다', async () => {
      const { result } = renderHook(() => useNoteAutosave({ noteId: 5, initialData }));
      const editor = makeEditor(repairedDoc, 'dupnew');

      act(() => {
        result.current.syncEditor(editor);
        result.current.cancelPendingSave();
        result.current.syncEditor(editor);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(client.put).toHaveBeenCalledTimes(1);
      expect(JSON.parse(client.put.mock.calls[0][1].content)).toEqual(repairedDoc);
    });

    it('고칠 것이 없으면 열기만 해서는 저장하지 않는다', async () => {
      const { result } = renderHook(() => useNoteAutosave({ noteId: 5, initialData }));

      act(() => {
        result.current.syncEditor(makeEditor(serverDoc, 'dupdup'));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(client.put).not.toHaveBeenCalled();
    });
  });
});
