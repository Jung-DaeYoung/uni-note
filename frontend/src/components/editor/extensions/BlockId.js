import { Extension } from '@tiptap/core';

export default Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        // 최상위 블록으로 작동할 노드 타입들
        types: ['paragraph', 'heading', 'blockquote', 'codeBlock', 'taskList'],
        attributes: {
          id: {
            default: null,
            // HTML 렌더링 시 data-id 속성 부여
            renderHTML: attributes => ({
              'data-id': attributes.id || Math.random().toString(36).substring(2, 9),
            }),
            // HTML 파싱 시 data-id 속성 읽기
            parseHTML: element => element.getAttribute('data-id'),
          },
          // ProseMirror 기본 드래그 기능을 활성화하기 위한 속성
          draggable: {
            default: true,
            renderHTML: () => ({
              draggable: 'true',
            }),
          },
        },
      },
    ];
  },
});
