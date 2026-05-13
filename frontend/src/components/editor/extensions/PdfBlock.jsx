import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';

const PdfBlockComponent = ({ node }) => {
  const { src, title } = node.attrs;

  const handleDownload = (e) => {
    e.preventDefault();
    const link = document.createElement('a');
    link.href = src;
    link.download = title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            PDF Document
          </p>
        </div>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <a 
            href={src} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="새 탭에서 열기"
          >
            <ExternalLink size={18} />
          </a>
          <button 
            onClick={handleDownload}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
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
