import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const MAX_WAIT_MS = 2000;
const HIGHLIGHT_MS = 3000;
const NOT_FOUND_MESSAGE = '원문 블록을 찾을 수 없습니다. 노트가 수정되었거나 삭제되었을 수 있습니다.';

// 출처 추적: 오답노트/CBT 결과에서 "원문 보기"로 넘어온 블록을 찾아 스크롤·하이라이트한다.
const useSourceBlockScroll = (editor) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const state = location.state || {};
    // sourceBlockId가 정식 명칭이며, 예전 호출부가 남아 있을 경우를 위해 scrollToBlockId를 fallback으로 읽는다.
    const blockId = state.sourceBlockId || state.scrollToBlockId;
    if (!editor || !blockId) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const clearNavigationState = () => {
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: {} }
      );
    };

    let rafId = null;
    let highlightTimer = null;
    let cancelled = false;
    const deadline = Date.now() + MAX_WAIT_MS;

    const attempt = () => {
      if (cancelled) return;

      // 전역 document가 아니라 이 에디터 인스턴스의 DOM 범위 안에서만 찾는다.
      // 다른 화면에 같은 data-id가 있어도 충돌하지 않는다.
      const container = editor.view?.dom;
      const element = container?.querySelector(`[data-id="${blockId}"]`);

      if (element) {
        element.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'center',
        });
        element.classList.add('origin-highlight');
        // 키보드/스크린리더 사용자도 위치를 인지할 수 있도록 일시적으로 포커스를 옮긴다.
        element.setAttribute('tabindex', '-1');
        element.focus({ preventScroll: true });

        highlightTimer = setTimeout(() => {
          if (cancelled) return;
          element.classList.remove('origin-highlight');
          element.removeAttribute('tabindex');
          clearNavigationState();
        }, HIGHLIGHT_MS);
        return;
      }

      if (Date.now() < deadline) {
        rafId = requestAnimationFrame(attempt);
      } else {
        alert(NOT_FOUND_MESSAGE);
        clearNavigationState();
      }
    };

    rafId = requestAnimationFrame(attempt);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (highlightTimer) clearTimeout(highlightTimer);
    };
  }, [editor, location.state, location.pathname, location.search, navigate]);
};

export default useSourceBlockScroll;
