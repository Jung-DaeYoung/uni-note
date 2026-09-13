import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// 출처 추적: 특정 블록으로 스크롤 및 하이라이팅
const useSourceBlockScroll = (editor) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!editor || !location.state?.scrollToBlockId) return;

    const blockId = location.state.scrollToBlockId;

    const timer = setTimeout(() => {
      const element = document.querySelector(`[data-id="${blockId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('origin-highlight');

        // 애니메이션 완료 후 클래스 제거 및 상태 초기화
        setTimeout(() => {
          element.classList.remove('origin-highlight');
          navigate(location.pathname, { replace: true, state: {} });
        }, 3000);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [editor, location.state, navigate, location.pathname]);
};

export default useSourceBlockScroll;
