import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/react';
import { noteSchemaExtensions } from '../NotionEditor';
import KeywordSelectionMenu from './KeywordSelectionMenu';

const doc = (...paragraphs) => ({
  type: 'doc',
  content: paragraphs.map(([id, text]) => ({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text }] })),
});

let editor;
const makeEditor = (content) => {
  editor = new Editor({ extensions: noteSchemaExtensions, content });
  return editor;
};

// 문단 텍스트 안의 [start, end) 글자를 선택한다(문서 위치는 문단 시작 + 1).
const selectInParagraph = (paragraphIndex, start, end) => {
  let base = 0;
  editor.state.doc.forEach((node, offset, index) => {
    if (index === paragraphIndex) base = offset + 1;
  });
  act(() => {
    editor.commands.setTextSelection({ from: base + start, to: base + end });
  });
};

describe('KeywordSelectionMenu', () => {
  afterEach(() => editor?.destroy());

  it('선택한 텍스트와 선택이 속한 블록의 문맥·id를 넘긴다', async () => {
    const user = userEvent.setup();
    const onExplain = vi.fn();
    makeEditor(doc(['p1', '제목'], ['p2', 'JWT는   인증 토큰이다.']));
    render(<KeywordSelectionMenu editor={editor} onExplain={onExplain} />);

    selectInParagraph(1, 0, 3);
    await user.click(screen.getByRole('button', { name: '키워드 설명' }));

    expect(onExplain).toHaveBeenCalledWith({ keyword: 'JWT', context: 'JWT는   인증 토큰이다.', blockId: 'p2' });
  });

  it('선택을 해제하면 메뉴를 숨긴다', () => {
    makeEditor(doc(['p1', 'JWT 토큰']));
    render(<KeywordSelectionMenu editor={editor} onExplain={vi.fn()} />);
    selectInParagraph(0, 0, 3);
    expect(screen.getByRole('button', { name: '키워드 설명' })).toBeInTheDocument();

    selectInParagraph(0, 1, 1);
    expect(screen.queryByRole('button', { name: '키워드 설명' })).not.toBeInTheDocument();
  });

  it('텍스트를 선택하면 키워드 설명 버튼을 보여 주고, 누르면 선택 정보를 넘긴다', async () => {
    const user = userEvent.setup();
    const onExplain = vi.fn();
    makeEditor(doc(['p1', 'LRU 페이지 교체']));
    render(<KeywordSelectionMenu editor={editor} onExplain={onExplain} />);
    expect(screen.queryByRole('button', { name: '키워드 설명' })).not.toBeInTheDocument();

    selectInParagraph(0, 0, 3);
    await user.click(screen.getByRole('button', { name: '키워드 설명' }));

    expect(onExplain).toHaveBeenCalledWith({ keyword: 'LRU', context: 'LRU 페이지 교체', blockId: 'p1' });
  });

  it('80자를 넘게 선택하면 버튼을 비활성화하고 안내한다', () => {
    makeEditor(doc(['p1', 'a'.repeat(81)]));
    render(<KeywordSelectionMenu editor={editor} onExplain={vi.fn()} />);

    selectInParagraph(0, 0, 81);

    expect(screen.getByRole('button', { name: '키워드 설명' })).toBeDisabled();
    expect(screen.getByText('80자 이하로 선택하세요')).toBeInTheDocument();
  });

  it('onQuiz가 있으면 문제 만들기 버튼을 보여 주고, 80자를 넘어도 쓸 수 있다', async () => {
    const user = userEvent.setup();
    const onQuiz = vi.fn();
    makeEditor(doc(['p1', 'a'.repeat(81)]));
    render(<KeywordSelectionMenu editor={editor} onExplain={vi.fn()} onQuiz={onQuiz} />);

    selectInParagraph(0, 0, 81);
    await user.click(screen.getByRole('button', { name: '문제 만들기' }));

    expect(onQuiz).toHaveBeenCalledWith({ keyword: 'a'.repeat(81), context: 'a'.repeat(81), blockId: 'p1' });
  });
});
