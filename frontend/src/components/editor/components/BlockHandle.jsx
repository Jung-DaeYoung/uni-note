import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical, Trash2, Copy } from 'lucide-react';
import '../../../pages/QuizLibraryPage.css';
import './BlockHandle.css';

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
      className="bh"
      style={{ top }}
    >
      <button
        draggable="true"
        onDragStart={handleDragStart}
        onClick={selectBlock}
        aria-label="블록 선택·이동"
        aria-expanded={isMenuOpen}
        className="bh-grip"
      >
        <GripVertical size={16} />
      </button>

      {isMenuOpen && (
        <div className="bh-menu">
          <p className="bh-id">Block ID: {currentNode?.node.attrs.id}</p>
          <button onClick={duplicateBlock} className="bh-item">
            <Copy size={14} aria-hidden="true" /> 복제하기
          </button>
          <button onClick={deleteBlock} className="bh-item bh-item-danger">
            <Trash2 size={14} aria-hidden="true" /> 삭제하기
          </button>
        </div>
      )}
    </div>
  );
};

export default BlockHandle;
