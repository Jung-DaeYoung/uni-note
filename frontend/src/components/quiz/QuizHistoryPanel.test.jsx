import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizHistoryPanel from './QuizHistoryPanel';

describe('QuizHistoryPanel', () => {
  it('삭제 버튼은 onDelete만 호출하고 기록 상세 보기는 열지 않는다', async () => {
    const user = userEvent.setup();
    const onViewAttempt = vi.fn();
    // 실제 핸들러(useQuizLibrary.handleDeleteAttempt)처럼 이벤트 전파를 막는다.
    const onDelete = vi.fn((e) => e.stopPropagation());
    render(
      <QuizHistoryPanel
        attempts={[{ attemptId: 7, quizTitle: '페이지 교체', score: 1, totalQuestions: 2, createdAt: '2026-10-03T10:00:00' }]}
        isLoading={false}
        onViewAttempt={onViewAttempt}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: '페이지 교체 풀이 기록 삭제' }));

    expect(onDelete).toHaveBeenCalledWith(expect.anything(), 7);
    expect(onViewAttempt).not.toHaveBeenCalled();
  });
});
