import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Info, Share2, X } from 'lucide-react';

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
  notice: {
    Icon: Info,
    iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

// window.alert 대체. ConfirmProvider가 마운트되면 앱 알림 창으로 교체되고,
// 그 전(또는 Provider 없이 렌더링하는 테스트)에는 기본 alert로 동작한다(client.js의 registerLogoutHandler와 같은 방식).
let alertHandler = (message) => window.alert(message);
// eslint-disable-next-line react-refresh/only-export-components
export const showAlert =(message) => alertHandler(message);

// window.confirm/prompt 대체. await confirm({ title, message, variant, confirmLabel, cancelLabel }) → true/false
// hideCancel: 확인 버튼만 보인다(알림). input: { defaultValue }를 주면 입력란을 보여 주고 입력값/null을 반환한다.
export const ConfirmProvider = ({ children }) => {
  const [request, setRequest] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const requestRef = useRef(null);
  const titleId = useId();

  // Promise의 resolve는 두 번째 호출부터 무시되므로 ESC·클릭이 겹쳐도 결과는 한 번만 정해진다.
  const close = useCallback((result) => {
    requestRef.current?.resolve(result);
    requestRef.current = null;
    setRequest(null);
  }, []);

  const cancel = useCallback(() => close(requestRef.current?.input ? null : false), [close]);

  const confirm = useCallback((options) => new Promise((resolve) => {
    // 이전 요청이 남아 있으면 취소로 끝낸다.
    requestRef.current?.resolve(requestRef.current.input ? null : false);
    const next = { variant: 'danger', confirmLabel: '확인', cancelLabel: '취소', ...options, resolve };
    requestRef.current = next;
    setInputValue(next.input?.defaultValue ?? '');
    setRequest(next);
  }), []);

  useEffect(() => {
    alertHandler = (message) => confirm({ title: message, variant: 'notice', hideCancel: true });
    return () => { alertHandler = (message) => window.alert(message); };
  }, [confirm]);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        // 아래에 깔린 다른 모달의 ESC 처리까지 번지지 않게 막는다.
        e.stopPropagation();
        cancel();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [request, cancel]);

  const style = request ? (VARIANTS[request.variant] || VARIANTS.danger) : null;
  // 위험 동작은 Enter 실수로 확정되지 않도록 취소 버튼에 포커스를 둔다.
  const focusCancel = request?.variant === 'danger' && !request.hideCancel;

  const handleSubmit = (e) => {
    e.preventDefault();
    close(request.input ? inputValue : true);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 flex items-start gap-4">
              <div className={`shrink-0 p-3 rounded-2xl ${style.iconClass}`}>
                <style.Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 id={titleId} className="text-lg font-black text-slate-900 dark:text-slate-100 break-words whitespace-pre-line">
                  {request.title}
                </h2>
                {request.message && (
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-pre-line break-words">
                    {request.message}
                  </p>
                )}
                {request.input && (
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                    aria-label={request.title}
                    className="mt-4 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={cancel}
                aria-label="닫기"
                className="p-2 -m-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-2">
              {!request.hideCancel && (
                <button
                  type="button"
                  onClick={cancel}
                  autoFocus={focusCancel}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                >
                  {request.cancelLabel}
                </button>
              )}
              <button
                type="submit"
                autoFocus={!focusCancel && !request.input}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${style.buttonClass}`}
              >
                {request.confirmLabel}
              </button>
            </div>
          </form>
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
