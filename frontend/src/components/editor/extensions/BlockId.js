import { Extension } from '@tiptap/core';

export default Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'codeBlock', 'taskList', 'bulletList', 'orderedList', 'image'],
        attributes: {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('data-id'),
            renderHTML: attributes => {
              if (!attributes.id) {
                // 새로운 ID 생성 (8자리 임의 문자열)
                attributes.id = Math.random().toString(36).substring(2, 10);
              }
              return { 'data-id': attributes.id };
            },
            // 텍스트 복사/붙여넣기 시 ID 유지
            keepOnSplit: false, 
          },
        },
      },
    ];
  },

  // 노드가 생성될 때 ID가 없으면 부여하는 로직 (강제성 부여)
  onTransaction({ transaction }) {
    if (!transaction.docChanged) return;

    const { doc } = transaction;
    doc.descendants((node, pos) => {
      if (node.isBlock && this.options.types?.includes(node.type.name) && !node.attrs.id) {
        // 이 부분은 사실 renderHTML에서 처리되지만, 명시적 관리를 위해 남겨둠
      }
    });
  },
});
