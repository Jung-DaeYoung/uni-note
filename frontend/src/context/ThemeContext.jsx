import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'uninote-theme';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {}
});

// Provider와 그 짝인 훅을 같은 파일에 두는 관례이며, 이 훅 하나만을 위해 파일을
// 분리하면 Context/Provider/훅 세 파일로 흩어져 오히려 추적하기 어려워진다.
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

// localStorage 값이 없거나 손상된 경우 라이트 모드를 기본값으로 사용한다
// (OS의 prefers-color-scheme는 참고하지 않는다 — 수동 토글만 신뢰한다).
const readStoredTheme = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => readStoredTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    // 다른 탭에서 테마를 변경하면 storage 이벤트로 동기화한다.
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      setTheme(event.newValue === 'dark' ? 'dark' : 'light');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = useCallback(() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
