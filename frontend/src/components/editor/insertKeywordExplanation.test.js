import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/react';
import { noteSchemaExtensions } from './NotionEditor';
import { insertKeywordExplanation } from './insertKeywordExplanation';

let editor;
const makeEditor = (...paragraphs) => {
  editor = new Editor({
    extensions: noteSchemaExtensions,
    content: {
      type: 'doc',
      // 노트 문서는 제목(heading)으로 시작해야 한다(Document content: 'heading block*').
      content: [
        { type: 'heading', attrs: { id: 't', level: 1 }, content: [{ type: 'text', text: '제목' }] },
        ...paragraphs.map(([id, text]) => ({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text }] })),
      ],
    },
  });
};

const topLevel = () => editor.getJSON().content.slice(1); // 제목 제외
const texts = (node) => node.content.map(p => p.content?.[0]?.text);

describe('insertKeywordExplanation', () => {
  afterEach(() => editor?.destroy());

  it('선택한 블록 바로 뒤에 인용 블록으로 넣고, 빈 줄로 문단을 나누고 AI 표시를 붙인다', () => {
    makeEditor(['p1', '첫 문단'], ['p2', 'JWT 문단'], ['p3', '끝 문단']);

    const ok = insertKeywordExplanation(editor, { blockId: 'p2', keyword: 'JWT', text: '토큰이다.\n\n서명으로 검증한다.', label: '3줄 요약' });

    expect(ok).toBe(true);
    const blocks = topLevel();
    expect(blocks.map(b => b.type)).toEqual(['paragraph', 'paragraph', 'blockquote', 'paragraph']);
    expect(texts(blocks[2])).toEqual(['JWT: 토큰이다.', '서명으로 검증한다.', 'AI 생성 설명 · 3줄 요약']);
    expect(blocks[2].content[2].content[0].marks).toEqual([{ type: 'italic' }]);
    // 새 블록에도 BlockId가 붙는다.
    expect(blocks[2].attrs.id).toBeTruthy();
  });

  it('블록을 찾지 못하면 문서 끝에 넣는다', () => {
    makeEditor(['p1', '첫 문단']);

    insertKeywordExplanation(editor, { blockId: 'gone', keyword: 'LRU', text: '교체 알고리즘', label: '쉬운 설명' });

    // 에디터가 문서 끝에 빈 문단을 하나 더 두므로 인용 블록 다음까지만 본다.
    const blocks = topLevel();
    expect(blocks.map(b => b.type).slice(0, 2)).toEqual(['paragraph', 'blockquote']);
    expect(texts(blocks[1])[0]).toBe('LRU: 교체 알고리즘');
  });
});
