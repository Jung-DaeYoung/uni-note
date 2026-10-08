import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import BlockId, { BLOCK_ID_REPAIR_META } from './BlockId';

const ids = (editor) => editor.getJSON().content.map(node => node.attrs?.id);
const paragraph = (text, id = null) => ({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text }] });

let editor;
afterEach(() => editor?.destroy());

describe('BlockId', () => {
  it('새로 만든 문단마다 서로 다른 id를 준다', () => {
    editor = new Editor({ extensions: [StarterKit, BlockId], content: '<p>a</p>' });
    editor.view.dispatch(editor.state.tr.setMeta(BLOCK_ID_REPAIR_META, true));
    for (const text of ['b', 'c', 'd']) {
      editor.commands.focus('end');
      editor.commands.splitBlock();
      editor.commands.insertContent(text);
    }
    editor.commands.insertContentAt(editor.state.doc.content.size, '<p>e</p><p>f</p>');

    const result = ids(editor);
    expect(result).toHaveLength(6);
    expect(result.every(Boolean)).toBe(true);
    expect(new Set(result).size).toBe(6);
  });

  it('겹친 id는 처음 블록만 유지하고 나머지를 새 id로 바꾼다', () => {
    editor = new Editor({
      extensions: [StarterKit, BlockId],
      content: { type: 'doc', content: [paragraph('a', 'dup'), paragraph('b', 'dup'), paragraph('c', 'dup'), paragraph('d', 'keep')] },
    });
    editor.view.dispatch(editor.state.tr.setMeta(BLOCK_ID_REPAIR_META, true));

    const result = ids(editor);
    expect(result[0]).toBe('dup');
    expect(result[3]).toBe('keep');
    expect(new Set(result).size).toBe(4);
  });
});
