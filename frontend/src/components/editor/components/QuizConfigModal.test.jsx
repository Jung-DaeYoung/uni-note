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
});
