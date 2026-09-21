import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CBTPlayer from './CBTPlayer';
import client from '../../../api/client';

vi.mock('../../../api/client', () => ({
  default: {
    post: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

const quizData = {
  title: '테스트 퀴즈',
  difficulty: 'NORMAL',
  quizSetId: 10,
  questions: [
    { questionId: 1, type: 'OX', questionText: 'Q1', correctAnswer: 'O', explanation: '설명' },
  ],
};

describe('CBTPlayer 제출', () => {
  beforeEach(() => {
    client.post.mockClear();
    // jsdom은 Element.scrollTo를 구현하지 않는다. CBTPlayer가 화면 전환 시 호출하므로 스텁한다.
    window.HTMLElement.prototype.scrollTo = vi.fn();
  });

  // score/isCorrect는 API 계약에서 제거됐다(서버가 실제 정답으로 직접 채점하므로 신뢰할
  // 수 없는 클라이언트 계산값을 보낼 이유가 없다). 요청에 questionId/submittedAnswer만
  // 담겨 나가는지 확인해 다시 추가되는 회귀를 막는다.
  it('제출 시 score/isCorrect 없이 questionId와 submittedAnswer만 서버로 보낸다', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CBTPlayer quizData={quizData} onClose={() => {}} courseId={1} />
      </MemoryRouter>
    );

    await user.click(screen.getByText('O'));
    await user.click(screen.getByText('제출하고 채점하기'));

    expect(client.post).toHaveBeenCalledWith('/quiz/attempts', {
      quizSetId: 10,
      userAnswers: [{ questionId: 1, submittedAnswer: 'O' }],
    });
  });
});
