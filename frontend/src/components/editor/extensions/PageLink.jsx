import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { useNoteTree } from '../../../context/NoteTreeContext';

// 페이지 링크를 보여줄 React 컴포넌트.
// Tiptap 확장은 NodeView 컴포넌트를 같은 파일에 정의하는 것이 관례이며, 이 확장 하나만을
// 위해 컴포넌트를 별도 파일로 분리하면 각 확장 파일마다 대응 파일이 늘어나는 비용이 더 크다.
// eslint-disable-next-line react-refresh/only-export-components
const PageLinkComponent = ({ node }) => {
  const { noteId, title: attrsTitle } = node.attrs;
  const { findTitle } = useNoteTree();
  
  // 컨텍스트에서 최신 제목 찾기, 없으면 저장된 속성값 사용
  const currentTitle = findTitle(noteId) || attrsTitle;

  return (
    <NodeViewWrapper className="page-link-wrapper" data-type="page-link">
      <div className="page-link-container">
        <span className="page-link-icon">📄</span>
        <span className="page-link-title-text">{currentTitle || '제목 없음'}</span>
      </div>
    </NodeViewWrapper>
  );
};

export default Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      noteId: {
        default: null,
      },
      title: {
        default: '제목 없음',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="page-link"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page-link' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkComponent);
  },
});
