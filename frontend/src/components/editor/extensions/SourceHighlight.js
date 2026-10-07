import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// "원문 보기"로 넘어온 블록 하이라이트. ProseMirror가 관리하는 노드 DOM에 class를 직접 붙이면
// 에디터가 속성 변경을 감지해 노드를 다시 그리면서 class가 바로 사라지므로, 노드 데코레이션으로 붙인다.
const sourceHighlightKey = new PluginKey('sourceHighlight');

export default Extension.create({
  name: 'sourceHighlight',

  addCommands() {
    return {
      setSourceHighlight: (pos) => ({ tr, dispatch }) => {
        if (dispatch) tr.setMeta(sourceHighlightKey, pos);
        return true;
      },
      clearSourceHighlight: () => ({ tr, dispatch }) => {
        if (dispatch) tr.setMeta(sourceHighlightKey, null);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: sourceHighlightKey,
        state: {
          init: () => null,
          // 하이라이트할 노드 위치. 편집으로 문서가 바뀌어도 같은 노드를 따라간다.
          apply: (tr, pos) => {
            const meta = tr.getMeta(sourceHighlightKey);
            if (meta !== undefined) return meta;
            return pos === null ? null : tr.mapping.map(pos);
          },
        },
        props: {
          decorations: (state) => {
            const pos = sourceHighlightKey.getState(state);
            const node = pos === null ? null : state.doc.nodeAt(pos);
            if (!node) return null;
            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + node.nodeSize, { class: 'origin-highlight' }),
            ]);
          },
        },
      }),
    ];
  },
});
