import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import BlockId from './BlockId';
import SourceHighlight from './SourceHighlight';

const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', attrs: { id: 'b-1' }, content: [{ type: 'text', text: '첫 블록' }] },
    { type: 'paragraph', attrs: { id: 'b-2' }, content: [{ type: 'text', text: '원문 블록' }] },
  ],
};

let editor;
const block = (id) => editor.view.dom.querySelector(`[data-id="${id}"]`);

describe('SourceHighlight', () => {
  afterEach(() => editor?.destroy());

  it('하이라이트가 편집으로 노드가 다시 그려져도 유지되고, 해제하면 사라진다', () => {
    editor = new Editor({ extensions: [StarterKit, BlockId, SourceHighlight], content: doc });
    const pos = editor.state.doc.child(0).nodeSize; // 두 번째 블록 시작 위치

    editor.commands.setSourceHighlight(pos);
    expect(block('b-2').classList.contains('origin-highlight')).toBe(true);
    expect(block('b-1').classList.contains('origin-highlight')).toBe(false);

    // 앞 블록에 글자를 넣어 위치가 밀리고 노드가 다시 그려져도 같은 블록에 남아야 한다.
    editor.commands.insertContentAt(1, '추가 ');
    editor.commands.insertContentAt(pos + 4, '!');
    expect(block('b-2').classList.contains('origin-highlight')).toBe(true);

    editor.commands.clearSourceHighlight();
    expect(block('b-2').classList.contains('origin-highlight')).toBe(false);
  });
});
