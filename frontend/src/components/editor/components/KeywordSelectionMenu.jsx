import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

// KeywordExplainRequest의 keyword @Size(max = 80) / context @Size(max = 2000)와 같게 유지한다.
export const MAX_KEYWORD_LENGTH = 80;
export const MAX_CONTEXT_LENGTH = 2000;

// 선택한 텍스트와, 선택이 시작된 최상위 블록의 텍스트(문맥)·id. 텍스트가 없는 선택(이미지 등)은 null이다.
const getKeywordSelection = (state) => {
  const { from, to, empty, $from } = state.selection;
  if (empty) return null;
  const keyword = state.doc.textBetween(from, to, ' ').replace(/\s+/g, ' ').trim();
  if (!keyword) return null;
  const block = $from.depth > 0 ? $from.node(1) : null;
  return {
    keyword,
    context: (block?.textContent || '').trim().slice(0, MAX_CONTEXT_LENGTH),
    blockId: block?.attrs?.id ?? null,
  };
};

const KeywordSelectionMenu = ({ editor, onExplain }) => {
  const [menu, setMenu] = useState(null); // { selection, top, left }

  useEffect(() => {
    const update = () => {
      const selection = getKeywordSelection(editor.state);
      if (!selection) {
        setMenu(null);
        return;
      }
      let position = { top: 0, left: 0 };
      try {
        // BlockHandle과 같이 에디터 DOM 기준 좌표를 쓴다.
        const coords = editor.view.coordsAtPos(editor.state.selection.to);
        const editorRect = editor.view.dom.getBoundingClientRect();
        position = { top: coords.bottom - editorRect.top + 6, left: coords.left - editorRect.left };
      } catch {
        // 위치 계산 실패(테스트 환경 등)는 기본 위치로 둔다.
      }
      setMenu({ selection, ...position });
    };
    const hide = () => setMenu(null);
    editor.on('selectionUpdate', update);
    editor.on('blur', hide);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('blur', hide);
    };
  }, [editor]);

  if (!menu) return null;
  const tooLong = menu.selection.keyword.length > MAX_KEYWORD_LENGTH;

  return (
    <div
      className="absolute z-30 flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg"
      style={{ top: menu.top, left: menu.left }}
      // 버튼을 눌러도 에디터 선택이 풀리지 않게 한다.
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        disabled={tooLong}
        onClick={() => onExplain(menu.selection)}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:pointer-events-none"
      >
        <BookOpen size={13} />
        키워드 설명
      </button>
      {tooLong && (
        <span className="text-[11px] text-amber-600 dark:text-amber-400">{MAX_KEYWORD_LENGTH}자 이하로 선택하세요</span>
      )}
    </div>
  );
};

export default KeywordSelectionMenu;
