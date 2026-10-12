import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical, Trash2, Copy } from 'lucide-react';

const BlockHandle = ({ editor }) => {
  const [top, setTop] = useState(-100);
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
        const { doc } = view.state;
        const $pos = doc.resolve(posAtCoords.inside >= 0 ? posAtCoords.inside : posAtCoords.pos);
        // 이미지/PDF 같은 atom 블록은 depth 0으로 해석되어 node(1)이 없으므로,
        // 그 위치의 노드를 그대로 쓴다(그렇지 않으면 핸들이 직전 블록에 남아 엉뚱한 블록을 지운다).
        const pos = $pos.depth > 0 ? $pos.before(1) : $pos.pos;
        const node = doc.nodeAt(pos);

        if (node) {
          const dom = view.nodeDOM(pos);
          if (dom instanceof HTMLElement) {
            const rect = dom.getBoundingClientRect();
            const editorRect = view.dom.getBoundingClientRect();
            setTop(rect.top - editorRect.top);
            setCurrentNode({ node, pos });
          }
        }
      } catch {
        // 위치 계산 중 DOM 접근 실패는 무시한다.
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
    if (!isMenuOpen) return;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // 드래그 시작 시 데이터 설정
  const handleDragStart = (e) => {
    if (!currentNode || !currentNode.node) return;
    
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
    if (!currentNode || !currentNode.node) return;
    try {
      editor.commands.setNodeSelection(currentNode.pos);
      setIsMenuOpen(true);
    } catch (err) {
      console.error("Block selection failed:", err);
    }
  };

  const deleteBlock = () => {
    if (!currentNode || !currentNode.node) return;
    editor.chain().focus().deleteRange({ 
      from: currentNode.pos, 
      to: currentNode.pos + currentNode.node.nodeSize 
    }).run();
    setIsMenuOpen(false);
  };

  const duplicateBlock = () => {
    if (!currentNode || !currentNode.node) return;
    const { node, pos: nodePos } = currentNode;
    editor.chain().focus().insertContentAt(nodePos + node.nodeSize, node.toJSON()).run();
    setIsMenuOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-20 transition-all duration-100 group"
      style={{ top, left: 0 }}
    >
      <button
        draggable="true"
        onDragStart={handleDragStart}
        onClick={selectBlock}
        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <GripVertical size={16} />
      </button>

      {isMenuOpen && (
        <div className="absolute left-8 top-0 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1 animate-in fade-in zoom-in duration-100">
          <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 mb-1">
            Block ID: {currentNode?.node.attrs.id}
          </div>
          <button onClick={duplicateBlock} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
            <Copy size={14} /> 복제하기
          </button>
          <button onClick={deleteBlock} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
            <Trash2 size={14} /> 삭제하기
          </button>
        </div>
      )}
    </div>
  );
};

export default BlockHandle;
