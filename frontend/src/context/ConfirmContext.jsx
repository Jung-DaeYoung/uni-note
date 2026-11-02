import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import '../pages/QuizLibraryPage.css';
import './ConfirmContext.css';

const ConfirmContext = createContext(null);

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
        <div className="cf-overlay">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onSubmit={handleSubmit}
            className="cf"
          >
            <div className="cf-head">
              <h2 id={titleId} className="cf-title">{request.title}</h2>
              <button type="button" onClick={cancel} aria-label="닫기" className="lib-icon cf-close">
                <X size={18} />
              </button>
            </div>
            {request.message && <p className="cf-message">{request.message}</p>}
            {request.input && (
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={(e) => e.target.select()}
                autoFocus
                aria-label={request.title}
                className="cf-input"
              />
            )}
            <div className="cf-actions">
              {!request.hideCancel && (
                <button
                  type="button"
                  onClick={cancel}
                  autoFocus={focusCancel}
                  className="lib-btn"
                >
                  {request.cancelLabel}
                </button>
              )}
              <button
                type="submit"
                autoFocus={!focusCancel && !request.input}
                className={`lib-btn ${request.variant === 'danger' ? 'cf-danger' : 'lib-btn-primary'}`}
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
