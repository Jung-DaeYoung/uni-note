import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizConfigModal from './QuizConfigModal';
import { NoteTreeProvider } from '../../../context/NoteTreeContext';
import client from '../../../api/client';

vi.mock('../../../api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const noteTree = [
  {
    noteId: 1,
    title: '부모 노트',
    children: [
      { noteId: 2, title: '자식 노트', children: [] },
    ],
  },
];

const renderModal = ({ currentNoteId = 1, onClose = vi.fn(), onGenerated = vi.fn() } = {}) => {
  render(
    <NoteTreeProvider noteTree={noteTree}>
      <QuizConfigModal isOpen currentNoteId={currentNoteId} onClose={onClose} onGenerated={onGenerated} />
    </NoteTreeProvider>
  );
  return { onClose, onGenerated };
};

describe('QuizConfigModal', () => {
  beforeEach(() => {
    client.post.mockReset();
    client.get.mockReset();
  });

  it('노트 트리를 렌더링하고 currentNoteId를 기본 선택한다', () => {
    renderModal({ currentNoteId: 1 });

    expect(screen.getByText('부모 노트')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /부모 노트/ })).toBeChecked();
  });

  it('노트 선택 시 하위 노트도 함께 선택된다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 999 });

    // 이 시점엔 자식 노트가 아직 DOM에 없으므로(펼치기 전) 펼치기 버튼이 유일하게 매칭된다.
    await user.click(screen.getByRole('button', { name: '하위 노트 펼치기' }));

    const parentCheckbox = screen.getByRole('checkbox', { name: /부모 노트/ });
    expect(parentCheckbox).not.toBeChecked();

    await user.click(parentCheckbox);

    expect(parentCheckbox).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /자식 노트/ })).toBeChecked();
  });

  it('선택된 노트가 없으면 생성 버튼이 비활성화되고 이유가 표시된다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('checkbox', { name: /부모 노트/ }));

    expect(screen.getByText('노트를 하나 이상 선택하세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '문제 생성 시작' })).toBeDisabled();
  });

  it('모든 문제 유형을 비활성화하면 생성 버튼이 비활성화되고 이유가 표시된다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('checkbox', { name: /객관식/ }));
    await user.click(screen.getByRole('checkbox', { name: /OX 퀴즈/ }));
    await user.click(screen.getByRole('checkbox', { name: /주관식/ }));

    expect(screen.getByText('문제 유형을 하나 이상 선택하세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '문제 생성 시작' })).toBeDisabled();
  });

  it('문항 수 입력을 비우고 포커스를 옮기면 1로 복구된다', () => {
    renderModal({ currentNoteId: 1 });

    const input = screen.getByRole('spinbutton', { name: '객관식 문항 수' });

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input).toHaveValue(1);
  });

  it('+/- 스테퍼와 직접 입력이 1~20 범위를 벗어나지 않는다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 1 });

    const minusBtn = screen.getByRole('button', { name: '객관식 문항 수 줄이기' });
    const plusBtn = screen.getByRole('button', { name: '객관식 문항 수 늘리기' });
    const input = screen.getByRole('spinbutton', { name: '객관식 문항 수' });

    await user.click(minusBtn); // 초기값 2 -> 1
    expect(input).toHaveValue(1);
    expect(minusBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: '20' } });
    expect(input).toHaveValue(20);
    expect(plusBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: '25' } });
    expect(input).toHaveValue(20);
  });

  it('난이도를 변경하면 선택 상태가 전환된다', async () => {
    const user = userEvent.setup();
    renderModal({ currentNoteId: 1 });

    const hard = screen.getByRole('radio', { name: /상 · 심화/ });
    const normal = screen.getByRole('radio', { name: /중 · 보통/ });

    expect(normal).toHaveAttribute('aria-checked', 'true');
    expect(hard).toHaveAttribute('aria-checked', 'false');

    await user.click(hard);

    expect(hard).toHaveAttribute('aria-checked', 'true');
    expect(normal).toHaveAttribute('aria-checked', 'false');
  });

  it('생성 성공 시 payload를 전송하고 onGenerated 이후 onClose를 호출한다', async () => {
    const user = userEvent.setup();
    client.post.mockResolvedValueOnce({ data: { quizSetId: 99 } });
    const { onClose, onGenerated } = renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(client.post).toHaveBeenCalledWith('/quiz/generate', {
      noteIds: [1],
      typeCounts: { MULTIPLE_CHOICE: 2, OX: 2, SHORT_ANSWER: 1 },
      difficulty: 'NORMAL',
    });
    expect(onGenerated).toHaveBeenCalledWith({ quizSetId: 99 });
    expect(onGenerated.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it('생성 실패 시 서버가 보낸 메시지를 표시하고 모달을 닫지 않는다', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    client.post.mockRejectedValueOnce({
      response: { status: 503, data: { errorCode: 'QUIZ_VALIDATION_FAILED', message: '요청한 조건에 맞는 문제를 생성하지 못했습니다.' } },
    });
    const { onClose, onGenerated } = renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('요청한 조건에 맞는 문제를 생성하지 못했습니다.'));
    expect(onGenerated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('서버 메시지가 없으면 기본 실패 문구를 표시한다', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    client.post.mockRejectedValueOnce(new Error('Network Error'));
    renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('문제 생성 중 오류가 발생했습니다.'));
    alertSpy.mockRestore();
  });

  it('생성 중에는 닫기·취소 버튼이 비활성화되고 로딩 표시가 나타난다', async () => {
    const user = userEvent.setup();
    let resolvePost;
    client.post.mockReturnValueOnce(new Promise((resolve) => { resolvePost = resolve; }));

    renderModal({ currentNoteId: 1 });

    await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

    expect(screen.getByText('문제 생성 중...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '문제 생성 설정 닫기' })).toBeDisabled();

    resolvePost({ data: {} });
    await waitFor(() => expect(screen.queryByText('문제 생성 중...')).not.toBeInTheDocument());
  });

  describe('블록 선택 모드', () => {
    // 제목(t) 다음에 h2 "개요"(아래 문단 p1, h3 "세부"와 그 아래 문단 p2), h2 "결론"(p3), id 없는 pdfBlock
    const savedNote = {
      noteId: 1,
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { id: 't', level: 1 }, content: [{ type: 'text', text: '노트 제목' }] },
          { type: 'heading', attrs: { id: 'h-intro', level: 2 }, content: [{ type: 'text', text: '개요' }] },
          { type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: '개요 본문' }] },
          { type: 'heading', attrs: { id: 'h-detail', level: 3 }, content: [{ type: 'text', text: '세부' }] },
          { type: 'paragraph', attrs: { id: 'p2' }, content: [{ type: 'text', text: '세부 본문' }] },
          { type: 'heading', attrs: { id: 'h-end', level: 2 }, content: [{ type: 'text', text: '결론' }] },
          { type: 'paragraph', attrs: { id: 'p3' }, content: [{ type: 'text', text: '결론 본문' }] },
          { type: 'pdfBlock', attrs: { src: 'x.pdf' } },
        ],
      }),
    };

    const enterBlockMode = async (user) => {
      client.get.mockResolvedValueOnce({ data: savedNote });
      await user.click(screen.getByRole('radio', { name: '블록 선택' }));
      await screen.findByRole('checkbox', { name: /개요 본문/ });
    };

    it('저장본을 다시 읽어 제목을 제외한 id 보유 블록만 보여준다', async () => {
      const user = userEvent.setup();
      renderModal({ currentNoteId: 1 });

      await enterBlockMode(user);

      expect(client.get).toHaveBeenCalledWith('/notes/1');
      expect(screen.queryByRole('checkbox', { name: /노트 제목/ })).not.toBeInTheDocument();
      expect(screen.getAllByRole('checkbox', { name: /개요|세부|결론/ })).toHaveLength(6);
      expect(screen.getByText('PDF 등 일부 블록은 노트 전체 모드에서만 포함됩니다')).toBeInTheDocument();
      expect(screen.getByText('블록을 하나 이상 선택하세요')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '문제 생성 시작' })).toBeDisabled();
    });

    it('heading을 선택하면 다음 같은 레벨 이하 heading 전까지 함께 선택·해제된다', async () => {
      const user = userEvent.setup();
      renderModal({ currentNoteId: 1 });
      await enterBlockMode(user);

      const intro = screen.getByRole('checkbox', { name: /제목 2\s*개요$/ });
      await user.click(intro);

      expect(screen.getByRole('checkbox', { name: /개요 본문/ })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /제목 3\s*세부$/ })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /세부 본문/ })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /결론$/ })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /결론 본문/ })).not.toBeChecked();

      await user.click(intro);

      expect(screen.getByRole('checkbox', { name: /세부 본문/ })).not.toBeChecked();
    });

    it('블록 모드 payload에만 blockIds가 노트 순서대로 들어간다', async () => {
      const user = userEvent.setup();
      client.post.mockResolvedValueOnce({ data: { quizSetId: 7 } });
      const { onClose } = renderModal({ currentNoteId: 1 });
      await enterBlockMode(user);

      await user.click(screen.getByRole('checkbox', { name: /결론 본문/ }));
      await user.click(screen.getByRole('checkbox', { name: /개요 본문/ }));
      await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(client.post).toHaveBeenCalledWith('/quiz/generate', {
        noteIds: [1],
        blockIds: ['p1', 'p3'],
        typeCounts: { MULTIPLE_CHOICE: 2, OX: 2, SHORT_ANSWER: 1 },
        difficulty: 'NORMAL',
      });
    });

    it('노트 전체 모드로 돌아가면 payload에 blockIds가 없다', async () => {
      const user = userEvent.setup();
      client.post.mockResolvedValueOnce({ data: {} });
      const { onClose } = renderModal({ currentNoteId: 1 });
      await enterBlockMode(user);
      await user.click(screen.getByRole('checkbox', { name: /개요 본문/ }));

      await user.click(screen.getByRole('radio', { name: '노트 전체' }));
      await user.click(screen.getByRole('button', { name: '문제 생성 시작' }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(client.post.mock.calls[0][1]).not.toHaveProperty('blockIds');
    });

    it('자동 저장 중이면 생성 버튼이 비활성화된다', async () => {
      const user = userEvent.setup();
      render(
        <NoteTreeProvider noteTree={noteTree}>
          <QuizConfigModal isOpen currentNoteId={1} onClose={vi.fn()} onGenerated={vi.fn()} saveStatus="saving" />
        </NoteTreeProvider>
      );
      await enterBlockMode(user);
      await user.click(screen.getByRole('checkbox', { name: /개요 본문/ }));

      expect(screen.getByText('노트 자동 저장이 끝난 뒤 생성할 수 있습니다')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '문제 생성 시작' })).toBeDisabled();
    });

    it('블록 목록을 불러오지 못하면 사유를 표시하고 생성할 수 없다', async () => {
      const user = userEvent.setup();
      client.get.mockRejectedValueOnce(new Error('Network Error'));
      renderModal({ currentNoteId: 1 });

      await user.click(screen.getByRole('radio', { name: '블록 선택' }));

      expect(await screen.findAllByText('블록 목록을 불러오지 못했습니다.')).not.toHaveLength(0);
      expect(screen.getByRole('button', { name: '문제 생성 시작' })).toBeDisabled();
    });
  });
});
