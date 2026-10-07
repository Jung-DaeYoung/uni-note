import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const MAX_WAIT_MS = 2000;
const POLL_MS = 50;
const HIGHLIGHT_MS = 3000;
const NOT_FOUND_MESSAGE = '원문 블록을 찾을 수 없습니다. 노트가 수정되었거나 삭제되었을 수 있습니다.';

// 이 에디터 문서에서 BlockId(attrs.id = DOM data-id)가 일치하는 블록의 위치를 찾는다.
const findBlockPos = (doc, blockId) => {
  let found = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.attrs?.id === blockId) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
};

// 출처 추적: 오답노트/CBT 결과에서 "원문 보기"로 넘어온 블록을 찾아 스크롤·하이라이트한다.
// 하이라이트는 SourceHighlight 확장의 데코레이션으로 그린다(노드 DOM을 직접 바꾸면 에디터가 다시 그려 지워진다).
const useSourceBlockScroll = (editor) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const state = location.state || {};
    const blockId = state.sourceBlockId;
    if (!editor || !blockId) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const clearNavigationState = () => {
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: {} }
      );
    };

    let pollTimer = null;
    let highlightTimer = null;
    let cancelled = false;
    const deadline = Date.now() + MAX_WAIT_MS;

    // 노트 내용은 서버/로컬 데이터 동기화(syncEditor) 뒤에 채워지므로 잠시 기다리며 찾는다.
    // requestAnimationFrame은 가려진 탭에서 멈추므로 setTimeout으로 폴링한다.
    const attempt = () => {
      if (cancelled || editor.isDestroyed) return;

      const pos = findBlockPos(editor.state.doc, blockId);
      if (pos !== null) {
        editor.commands.setSourceHighlight(pos);
        editor.view.nodeDOM(pos)?.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'center',
        });
        // 키보드/스크린리더 사용자도 위치를 알 수 있도록 블록 안으로 커서를 옮긴다.
        editor.commands.focus(pos + 1, { scrollIntoView: false });

        highlightTimer = setTimeout(() => {
          if (cancelled || editor.isDestroyed) return;
          editor.commands.clearSourceHighlight();
          clearNavigationState();
        }, HIGHLIGHT_MS);
        return;
      }

      if (Date.now() < deadline) {
        pollTimer = setTimeout(attempt, POLL_MS);
      } else {
        alert(NOT_FOUND_MESSAGE);
        clearNavigationState();
      }
    };

    pollTimer = setTimeout(attempt, 0);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (highlightTimer) clearTimeout(highlightTimer);
      if (!editor.isDestroyed) editor.commands.clearSourceHighlight();
    };
  }, [editor, location.state, location.pathname, location.search, navigate]);
};

export default useSourceBlockScroll;
