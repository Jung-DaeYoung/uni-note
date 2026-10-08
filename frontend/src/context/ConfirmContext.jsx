import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Share2, X } from 'lucide-react';

const ConfirmContext = createContext(null);

const VARIANTS = {
  danger: {
    Icon: AlertTriangle,
    iconClass: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  share: {
    Icon: Share2,
    iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  navigate: {
    Icon: ArrowRight,
    iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
};

// window.confirm 대체. await confirm({ title, message, variant, confirmLabel, cancelLabel }) → true/false
export const ConfirmProvider = ({ children }) => {
  const [request, setRequest] = useState(null);
  const requestRef = useRef(null);
  const titleId = useId();

  // resolve는 요청당 한 번만 호출된다. ref를 먼저 비워 ESC·클릭이 겹쳐도 중복 resolve되지 않는다.
  const close = useCallback((result) => {
    const current = requestRef.current;
    if (!current) return;
    requestRef.current = null;
    setRequest(null);
    current.resolve(result);
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => {
    // 이전 요청이 남아 있으면 취소로 끝낸다.
    requestRef.current?.resolve(false);
    const next = { variant: 'danger', confirmLabel: '확인', cancelLabel: '취소', ...options, resolve };
    requestRef.current = next;
    setRequest(next);
  }), []);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        // 아래에 깔린 다른 모달의 ESC 처리까지 번지지 않게 막는다.
        e.stopPropagation();
        close(false);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [request, close]);

  const style = request ? (VARIANTS[request.variant] || VARIANTS.danger) : null;
  // 위험 동작은 Enter 실수로 확정되지 않도록 취소 버튼에 포커스를 둔다.
  const focusCancel = request?.variant === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 flex items-start gap-4">
              <div className={`shrink-0 p-3 rounded-2xl ${style.iconClass}`}>
                <style.Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 id={titleId} className="text-lg font-black text-slate-900 dark:text-slate-100 break-words">
                  {request.title}
                </h2>
                {request.message && (
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-pre-line break-words">
                    {request.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => close(false)}
                aria-label="닫기"
                className="p-2 -m-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                autoFocus={focusCancel}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              >
                {request.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                autoFocus={!focusCancel}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${style.buttonClass}`}
              >
                {request.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm은 ConfirmProvider 안에서만 사용할 수 있습니다.');
  return confirm;
};
