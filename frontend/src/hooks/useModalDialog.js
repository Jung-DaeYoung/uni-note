import { useEffect, useRef } from 'react';

// 열린 모달 순서. 겹쳐 열렸을 때(예: CBT 풀이 위의 오답노트 담기) 맨 위 모달만 키보드에 반응한다.
// 앱 확인창(ConfirmContext)은 캡처 단계에서 ESC를 먼저 처리하고 전파를 막으므로 그보다 위에 있다.
const openDialogs = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 모달 공통 키보드 동작: 열릴 때 초점을 모달 안으로 옮기고, Tab은 모달 안에서만 돌고,
// ESC로 닫고(closeOnEscape), 닫히면 열기 전 초점으로 돌아간다. 반환한 ref를 role="dialog" 요소에 단다.
export default function useModalDialog(isOpen, onClose, { closeOnEscape = true } = {}) {
  const dialogRef = useRef(null);
  // 닫기 함수와 ESC 허용 여부는 ref로 읽는다. 값이 바뀔 때 아래 효과가 다시 돌면
  // 초점이 모달 밖으로 돌아갔다 들어오기 때문이다(예: 퀴즈 생성 중 ESC 잠금).
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    const token = {};
    openDialogs.push(token);
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    // autoFocus된 입력칸이 이미 안에 있으면 그대로 둔다.
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();

    const onKeyDown = (e) => {
      if (openDialogs[openDialogs.length - 1] !== token || !dialog) return;
      if (e.key === 'Escape' && closeOnEscapeRef.current) {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.checkVisibility?.() ?? true);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openDialogs.splice(openDialogs.indexOf(token), 1);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isOpen]);

  return dialogRef;
}
