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
    const posAtCoords = view.posAtCoords({ left: e.clientX, top: e.clientY });

    if (posAtCoords) {
      try {
        const $pos = view.state.doc.resolve(posAtCoords.pos);
        const node = $pos.node(1); 
        const start = $pos.start(1);

        if (node) {
          const dom = view.nodeDOM(start - 1);
          if (dom instanceof HTMLElement) {
            const rect = dom.getBoundingClientRect();
            const editorRect = view.dom.getBoundingClientRect();

            setPos({
              top: rect.top - editorRect.top,
              left: 0,
            });
            setCurrentNode({ node, pos: start - 1 });
          }
        }
      } catch (e) {}
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

  // 드래그 시작 시 데이터 설정
  const handleDragStart = (e) => {
    if (!currentNode) return;
    
    // 블록 데이터 직렬화하여 전달
    const dragData = {
      pos: currentNode.pos,
      nodeSize: currentNode.node.nodeSize,
      nodeJSON: currentNode.node.toJSON()
    };
    
    e.dataTransfer.setData('block-drag', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    // 드래그 시 메뉴 닫기
    setIsMenuOpen(false);
  };

  const selectBlock = () => {
    if (!currentNode) return;
    editor.commands.setNodeSelection(currentNode.pos);
    setIsMenuOpen(true);
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
    const data = {
      id: currentNode.node.attrs.id,
      type: currentNode.node.type.name,
      text: currentNode.node.textContent
    };
    console.log("AI 연동 데이터:", data);
    alert(`블록 ID: ${data.id}\nAI 기능을 요청합니다.`);
    setIsMenuOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-20 transition-all duration-100 group"
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        draggable="true"
        onDragStart={handleDragStart}
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
