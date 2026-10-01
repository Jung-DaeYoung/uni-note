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
});
