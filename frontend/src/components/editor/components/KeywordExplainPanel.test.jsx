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

  it('문장마다 줄을 바꾸고, 3줄 요약은 앞의 3문장만 보여 준다', async () => {
    const user = userEvent.setup();
    client.post.mockResolvedValueOnce({ data: {
      ...explanation,
      summary: '첫째 문장. 둘째는 3.14다! 셋째인가? 넷째 문장.',
      easyExplanation: '하나. 둘.\n셋',
    } });
    render(<KeywordExplainPanel target={target} onClose={vi.fn()} onSelectKeyword={vi.fn()} onOpenMention={vi.fn()} onMakeQuiz={vi.fn()} />);

    await screen.findByText('첫째 문장.');
    const lines = () => [...screen.getByRole('tabpanel').querySelectorAll('p')].map(p => p.textContent);
    expect(lines()).toEqual(['첫째 문장.', '둘째는 3.14다!', '셋째인가?']);

    await user.click(screen.getByRole('tab', { name: '쉬운 설명' }));
    expect(lines()).toEqual(['하나.', '둘.', '셋']);
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
    expect(screen.queryByText('표준 설명')).toBeNull();

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

  it('설명을 만든 노트가 아니면 적용 버튼을 끄고 안내한다', async () => {
    client.post.mockResolvedValueOnce({ data: explanation });
    render(<KeywordExplainPanel target={target} onClose={vi.fn()} onSelectKeyword={vi.fn()} onOpenMention={vi.fn()} onMakeQuiz={vi.fn()} canInsert={false} onInsert={vi.fn()} />);

    expect(await screen.findByRole('button', { name: '노트에 적용' })).toBeDisabled();
    expect(screen.getByText('설명을 만든 노트에서만 적용할 수 있습니다')).toBeInTheDocument();
  });

  it('노트에 적용은 현재 탭의 설명과 탭 이름을 넘기고, 적용되면 안내한다', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn().mockResolvedValue(true);
    client.post.mockResolvedValueOnce({ data: explanation });
    render(<KeywordExplainPanel target={target} onClose={vi.fn()} onSelectKeyword={vi.fn()} onOpenMention={vi.fn()} onMakeQuiz={vi.fn()} canInsert onInsert={onInsert} />);

    await user.click(await screen.findByRole('tab', { name: '쉬운 설명' }));
    await user.click(screen.getByRole('button', { name: '노트에 적용' }));

    expect(onInsert).toHaveBeenCalledWith({ text: '쉬운 설명', label: '쉬운 설명' });
    expect(await screen.findByText('노트에 적용했습니다')).toBeInTheDocument();
  });

  it('사용자가 적용하지 않기로 하면 적용 안내를 띄우지 않는다', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn().mockResolvedValue(false);
    client.post.mockResolvedValueOnce({ data: explanation });
    render(<KeywordExplainPanel target={target} onClose={vi.fn()} onSelectKeyword={vi.fn()} onOpenMention={vi.fn()} onMakeQuiz={vi.fn()} canInsert onInsert={onInsert} />);

    await user.click(await screen.findByRole('button', { name: '노트에 적용' }));

    expect(onInsert).toHaveBeenCalled();
    expect(screen.queryByText('노트에 적용했습니다')).not.toBeInTheDocument();
    expect(screen.getByText('적용 전에 넣을 내용을 확인합니다')).toBeInTheDocument();
  });
});
