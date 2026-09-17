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

    it('localStorage 임시 저장본이 서버 데이터보다 최신이면 그것을 우선 사용한다', () => {
      const serverDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
      const localDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '임시 저장분' }] }] };
      localStorage.setItem('note-temp-1', JSON.stringify({ content: localDoc, timestamp: 999999 }));

      const { result } = renderHook(() =>
        useNoteAutosave({
          noteId: 1,
          initialData: { title: '제목', content: JSON.stringify(serverDoc), updatedAt: 100 },
        })
      );

      expect(result.current.getInitialContent()).toEqual(localDoc);
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
});
