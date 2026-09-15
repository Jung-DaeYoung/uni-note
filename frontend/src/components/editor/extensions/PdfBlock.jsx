import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../../api/client';
import { isAllowedFileUrl } from '../hooks/useNoteUploads';

const PdfBlockComponent = ({ node }) => {
  const { src, title } = node.attrs;
  // src는 노트 콘텐츠(JSON)에 저장된 값을 그대로 신뢰하지 않고, 우리 서버가 실제로
  // 서빙하는 경로인지 렌더링 시점에 다시 검증한다(스킴/오리진 조작 방지).
  const isSrcTrusted = isAllowedFileUrl(src);

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
      <div className="group flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all duration-200 cursor-default select-none">
        <div className="w-12 h-12 flex items-center justify-center bg-red-100 text-red-600 rounded-xl shrink-0 shadow-sm group-hover:scale-105 transition-transform">
          <FileText size={24} strokeWidth={2.5} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate leading-tight mb-0.5">
            {title || '이름 없는 PDF 파일'}
          </p>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isSrcTrusted ? 'PDF Document' : '허용되지 않은 파일 경로'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isSrcTrusted ? (
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="새 탭에서 열기"
            >
              <ExternalLink size={18} />
            </a>
          ) : (
            <span className="p-2 text-slate-300 cursor-not-allowed" title="허용되지 않은 파일 경로">
              <ExternalLink size={18} />
            </span>
          )}
          <button
            onClick={handleDownload}
            disabled={!isSrcTrusted}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title="다운로드"
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
