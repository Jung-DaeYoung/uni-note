import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeywordExplainPanel from './KeywordExplainPanel';
import { clearKeywordCache } from '../../../hooks/useKeywordExplanation';
import client from '../../../api/client';

vi.mock('../../../api/client', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

const target = { keyword: 'JWT', context: 'JWT는 토큰이다.', blockId: 'p1', noteId: 10, courseId: 1 };

const explanation = {
  keyword: 'JWT',
  summary: '요약 설명',
  easyExplanation: '쉬운 설명',
  advancedExplanation: '심화 설명',
  relatedKeywords: ['OAuth'],
  resources: [{
    title: "영어 위키백과에서 'JSON Web Token' 찾기",
    url: 'https://en.wikipedia.org/w/index.php?search=JSON+Web+Token',
    source: 'en.wikipedia.org',
    reason: '표준 설명',
  }],
};

describe('KeywordExplainPanel', () => {
  beforeEach(() => {
    client.post.mockReset();
    client.get.mockReset();
    client.get.mockResolvedValue({ data: [] });
    clearKeywordCache();
  });

  it('설명을 요청해 탭으로 보여 주고, 자료 링크는 새 탭으로 연다', async () => {
    const user = userEvent.setup();
    const onSelectKeyword = vi.fn();
    client.post.mockResolvedValueOnce({ data: explanation });
    render(<KeywordExplainPanel target={target} onClose={vi.fn()} onSelectKeyword={onSelectKeyword} onOpenMention={vi.fn()} onMakeQuiz={vi.fn()} />);

    expect(screen.getByText('설명을 만드는 중...')).toBeInTheDocument();
    expect(await screen.findByText('요약 설명')).toBeInTheDocument();
    expect(client.post).toHaveBeenCalledWith('/keywords/explain', {
      keyword: 'JWT', context: 'JWT는 토큰이다.', courseId: 1, noteId: 10, blockId: 'p1',
    });

    await user.click(screen.getByRole('tab', { name: '전공 심화' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('심화 설명');

    const link = screen.getByRole('link', { name: /JSON Web Token/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    await user.click(screen.getByRole('button', { name: 'OAuth' }));
    expect(onSelectKeyword).toHaveBeenCalledWith('OAuth');
  });

  it('실패하면 서버 메시지를 보여 주고 다시 시도할 수 있다', async () => {
    const user = userEvent.setup();
    client.post
      .mockRejectedValueOnce({ response: { data: { message: '키워드 설명은 10분에 20회까지 요청할 수 있습니다.' } } })
      .mockResolvedValueOnce({ data: explanation });
    render(<KeywordExplainPanel target={target} onClose={vi.fn()} onSelectKeyword={vi.fn()} onOpenMention={vi.fn()} onMakeQuiz={vi.fn()} />);

    expect(await screen.findByText('키워드 설명은 10분에 20회까지 요청할 수 있습니다.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('요약 설명')).toBeInTheDocument();
    expect(client.post).toHaveBeenCalledTimes(2);
  });

  it('같은 키워드·문맥을 다시 열면 캐시를 써서 요청하지 않는다', async () => {
    client.post.mockResolvedValueOnce({ data: explanation });
    const { unmount } = render(<KeywordExplainPanel target={target} onClose={vi.fn()} onSelectKeyword={vi.fn()} onOpenMention={vi.fn()} onMakeQuiz={vi.fn()} />);
    await screen.findByText('요약 설명');
    unmount();

    render(<KeywordExplainPanel target={{ ...target }} onClose={vi.fn()} onSelectKeyword={vi.fn()} onOpenMention={vi.fn()} onMakeQuiz={vi.fn()} />);

    expect(await screen.findByText('요약 설명')).toBeInTheDocument();
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('닫기 버튼은 onClose를 호출한다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    client.post.mockResolvedValueOnce({ data: explanation });
    render(<KeywordExplainPanel target={target} onClose={onClose} onSelectKeyword={vi.fn()} onOpenMention={vi.fn()} onMakeQuiz={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '키워드 설명 닫기' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('같은 강의의 노트 언급을 보여 주고, 누르면 그 언급을 넘긴다', async () => {
    const user = userEvent.setup();
    const onOpenMention = vi.fn();
    const mention = { noteId: 12, noteTitle: '보안 정리', blockId: 'b3', preview: '…JWT 서명 검증…' };
    client.post.mockResolvedValueOnce({ data: explanation });
    client.get.mockResolvedValueOnce({ data: [mention] });
    render(<KeywordExplainPanel target={target} onClose={vi.fn()} onSelectKeyword={vi.fn()} onOpenMention={onOpenMention} onMakeQuiz={vi.fn()} />);

    expect(client.get).toHaveBeenCalledWith('/keywords/mentions', { params: { keyword: 'JWT', courseId: 1 } });
    await user.click(await screen.findByRole('button', { name: /보안 정리/ }));
    expect(onOpenMention).toHaveBeenCalledWith(mention);
  });

  it('언급이 없으면 빈 상태를 보여 주고, 문제 만들기는 현재 대상을 넘긴다', async () => {
    const user = userEvent.setup();
    const onMakeQuiz = vi.fn();
    client.post.mockResolvedValueOnce({ data: explanation });
    render(<KeywordExplainPanel target={target} onClose={vi.fn()} onSelectKeyword={vi.fn()} onOpenMention={vi.fn()} onMakeQuiz={onMakeQuiz} />);

    expect(await screen.findByText('이 강의의 노트에서 찾지 못했습니다')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '문제 만들기' }));
    expect(onMakeQuiz).toHaveBeenCalledWith(target);
  });
});
