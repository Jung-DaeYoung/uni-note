// 키워드 AI 설명을 기존 노드(blockquote·paragraph)로 노트에 넣는다(새 Tiptap 노드 없음).
// 블록 id는 BlockId 플러그인이, 저장은 기존 자동 저장(onUpdate)이 맡는다.

// 넣을 문단 텍스트. 확인 모달의 미리보기와 실제 삽입이 같은 목록을 쓴다. 마지막 문단은 AI 생성 표시다.
export const explanationParagraphs = ({ keyword, text, label }) => {
  const [first, ...rest] = text.split(/\n\s*\n+/).map(part => part.trim()).filter(Boolean);
  return [`${keyword}: ${first ?? ''}`, ...rest, `AI 생성 설명 · ${label}`];
};

const textParagraph = (text, marks) => ({
  type: 'paragraph',
  content: [{ type: 'text', text, ...(marks && { marks }) }],
});

// blockId인 최상위 블록 바로 뒤 위치. 못 찾으면 문서 끝.
const positionAfterBlock = (doc, blockId) => {
  let position = doc.content.size;
  if (blockId) {
    doc.forEach((node, offset) => {
      if (node.attrs?.id === blockId) position = offset + node.nodeSize;
    });
  }
  return position;
};

export const insertKeywordExplanation = (editor, { blockId, keyword, text, label }) => {
  const paragraphs = explanationParagraphs({ keyword, text, label });
  const note = paragraphs.pop();
  const node = {
    type: 'blockquote',
    content: [...paragraphs.map(part => textParagraph(part)), textParagraph(note, [{ type: 'italic' }])],
  };
  return editor.chain().insertContentAt(positionAfterBlock(editor.state.doc, blockId), node).run();
};
