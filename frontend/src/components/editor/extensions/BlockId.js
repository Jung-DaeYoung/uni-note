import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const BLOCK_TYPES = ['paragraph', 'heading', 'blockquote', 'codeBlock', 'taskList', 'bulletList', 'orderedList', 'image'];

// 8자리 임의 문자열
const createId = () => Math.random().toString(36).substring(2, 10);

// 저장된 노트를 연 직후처럼 문서 변경 없이 id를 점검하고 싶을 때 이 meta를 붙여 dispatch한다.
export const BLOCK_ID_REPAIR_META = 'blockIdRepair';

export default Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('data-id'),
            // renderHTML에서 attrs를 바꾸면 안 된다. attrs 없이 만든 노드는 타입별 공유 객체
            // (NodeType.defaultAttrs)를 쓰므로, 거기에 id를 넣으면 이후 모든 문단이 같은 id가 된다.
            renderHTML: attributes => (attributes.id ? { 'data-id': attributes.id } : {}),
            keepOnSplit: false,
          },
        },
      },
    ];
  },

  // id가 없거나 앞에서 이미 쓰인(붙여넣기·기존 중복 저장본) 블록에 새 id를 준다.
  // 처음 나온 블록의 id는 유지해 기존 퀴즈 출처가 가리키는 블록을 보존한다.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockId'),
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some(tr => tr.docChanged || tr.getMeta(BLOCK_ID_REPAIR_META))) return null;
          const seen = new Set();
          const tr = newState.tr;
          newState.doc.descendants((node, pos) => {
            if (!BLOCK_TYPES.includes(node.type.name)) return;
            const { id } = node.attrs;
            if (id && !seen.has(id)) {
              seen.add(id);
              return;
            }
            let newId = createId();
            while (seen.has(newId)) newId = createId();
            seen.add(newId);
            tr.setNodeAttribute(pos, 'id', newId);
          });
          return tr.docChanged ? tr.setMeta('addToHistory', false) : null;
        },
      }),
    ];
  },
});
