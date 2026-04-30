import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical, Trash2, Copy, Sparkles } from 'lucide-react';

const BlockHandle = ({ editor }) => {
  const [pos, setPos] = useState({ top: -100, left: 0 });
  const [currentNode, setCurrentNode] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef(null);

  // 마우스 이동 시 최상위 블록 추적
  const handleMouseMove = useCallback((e) => {
    if (!editor || isMenuOpen) return;

    const view = editor.view;
    // 정확히 마우스 위치의 포지션 찾기
    const posAtCoords = view.posAtCoords({ left: e.clientX, top: e.clientY });

    if (posAtCoords) {
      try {
        const $pos = view.state.doc.resolve(posAtCoords.pos);
        const node = $pos.node(1); // 최상위 블록
        const start = $pos.start(1);

        if (node) {
          const dom = view.nodeDOM(start - 1);
          if (dom instanceof HTMLElement) {
            const rect = dom.getBoundingClientRect();
            const editorRect = view.dom.getBoundingClientRect();

            setPos({
              // 에디터 컨테이너 기준 상대 좌표 계산
              top: rect.top - editorRect.top,
              left: 0, // NotionEditor에서 준 padding-left 공간(32px) 안에 위치
            });
            setCurrentNode({ node, pos: start - 1 });
          }
        }
      } catch (e) {
        // 노드 경계 밖인 경우 무시
      }
    }
  }, [editor, isMenuOpen]);

  useEffect(() => {
    const dom = editor?.view.dom;
    if (dom) {
      dom.addEventListener('mousemove', handleMouseMove);
      return () => dom.removeEventListener('mousemove', handleMouseMove);
    }
  }, [editor, handleMouseMove]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // 현재 블록 선택 (NodeSelection)
  const selectBlock = () => {
    if (!currentNode) return;
    editor.commands.setNodeSelection(currentNode.pos);
    setIsMenuOpen(true);
  };

  // 블록 데이터 추출 (AI 연동용)
  const getBlockData = () => {
    if (!currentNode) return null;
    return {
      id: currentNode.node.attrs.id,
      type: currentNode.node.type.name,
      text: currentNode.node.textContent
    };
  };

  const deleteBlock = () => {
    editor.chain().focus().deleteRange({ from: currentNode.pos, to: currentNode.pos + currentNode.node.nodeSize }).run();
    setIsMenuOpen(false);
  };

  const duplicateBlock = () => {
    const { node, pos: nodePos } = currentNode;
    editor.chain().focus().insertContentAt(nodePos + node.nodeSize, node.toJSON()).run();
    setIsMenuOpen(false);
  };

  const handleAiAction = () => {
    const data = getBlockData();
    console.log("AI 연동 데이터:", data);
    alert(`블록 ID: ${data.id}\n내용: ${data.text}\n이 내용을 기반으로 AI 요청을 보냅니다.`);
    setIsMenuOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-20 transition-all duration-100 group"
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        onClick={selectBlock}
        className="p-1 hover:bg-slate-100 rounded cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600"
      >
        <GripVertical size={16} />
      </button>

      {isMenuOpen && (
        <div className="absolute left-8 top-0 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1 animate-in fade-in zoom-in duration-100">
          <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">
            Block ID: {currentNode?.node.attrs.id}
          </div>
          <button onClick={duplicateBlock} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg">
            <Copy size={14} /> 복제하기
          </button>
          <button onClick={deleteBlock} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg">
            <Trash2 size={14} /> 삭제하기
          </button>
          <div className="h-[1px] bg-slate-100 my-1" />
          <button onClick={handleAiAction} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-50 rounded-lg group/ai">
            <Sparkles size={14} className="group-hover/ai:animate-pulse" /> AI 요약/질문
          </button>
        </div>
      )}
    </div>
  );
};

export default BlockHandle;
