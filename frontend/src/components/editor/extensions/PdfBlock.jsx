import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../../api/client';
import { resolveFileUrl } from '../hooks/useNoteUploads';
import '../../../pages/QuizLibraryPage.css';
import './PdfBlock.css';

// Tiptap 확장은 NodeView 컴포넌트를 같은 파일에 정의하는 것이 관례이며, 이 확장 하나만을
// 위해 컴포넌트를 별도 파일로 분리하면 각 확장 파일마다 대응 파일이 늘어나는 비용이 더 크다.
// eslint-disable-next-line react-refresh/only-export-components
const PdfBlockComponent = ({ node }) => {
  const { src, title } = node.attrs;
  // src는 노트 콘텐츠(JSON)에 저장된 값을 그대로 신뢰하지 않고, 우리 서버가 실제로
  // 서빙하는 경로인지 렌더링 시점에 다시 검증한다(스킴/오리진 조작 방지).
  const resolvedSrc = resolveFileUrl(src);
  const isSrcTrusted = resolvedSrc !== null;

  const handleDownload = (e) => {
    e.preventDefault();
    if (!isSrcTrusted) return;
    // src는 "/api/upload/view/{fileName}?owner=...&sig=..." 형태이므로 쿼리스트링을
    // 제외한 파일명만 추출하고, 서명(owner/sig)이 있으면 다운로드 요청에도 함께 실어
    // 보내 본인이 업로드한 파일임을 증명한다. 서명이 없는 레거시 URL은 그대로 둔다.
    const url = new URL(src, window.location.origin);
    const fileName = url.pathname.substring(url.pathname.lastIndexOf("/") + 1);
    const params = new URLSearchParams({ originalName: title });
    const owner = url.searchParams.get("owner");
    const sig = url.searchParams.get("sig");
    if (owner && sig) {
      params.set("owner", owner);
      params.set("sig", sig);
    }
    // 백엔드의 강제 다운로드 API 호출
    window.location.href = `${API_BASE_URL}/api/upload/download/${fileName}?${params.toString()}`;
  };

  return (
    <NodeViewWrapper className="pdf-block-wrapper" data-type="pdf-block">
      <div className="pdfb">
        <FileText size={20} className="pdfb-icon" aria-hidden="true" />

        <div className="pdfb-body">
          <p className="pdfb-title">{title || '이름 없는 PDF 파일'}</p>
          <p className="pdfb-meta">{isSrcTrusted ? 'PDF Document' : '허용되지 않은 파일 경로'}</p>
        </div>

        {/* 마우스가 있는 기기에서만 올렸을 때 보인다. 터치 기기와 키보드 초점에서는 항상 보인다. */}
        <div className="pdfb-actions">
          {isSrcTrusted ? (
            <a
              href={resolvedSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="lib-icon"
              title="새 탭에서 열기"
              aria-label="새 탭에서 열기"
            >
              <ExternalLink size={18} />
            </a>
          ) : (
            <span className="lib-icon pdfb-disabled" title="허용되지 않은 파일 경로">
              <ExternalLink size={18} />
            </span>
          )}
          <button
            onClick={handleDownload}
            disabled={!isSrcTrusted}
            className="lib-icon"
            title="다운로드"
            aria-label="다운로드"
          >
            <Download size={18} />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export default Node.create({
  name: 'pdfBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      title: {
        default: '이름 없는 PDF 파일',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="pdf-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'pdf-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PdfBlockComponent);
  },
});
