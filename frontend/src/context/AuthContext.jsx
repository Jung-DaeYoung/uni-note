import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { registerLogoutHandler } from '../api/client';

const AuthContext = createContext(null);

// JWT는 검증 없이 payload만 디코드한다(만료 시각 확인용 - 서버가 어차피 서명을 검증한다).
const decodeJwtPayload = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const isTokenValid = (token) => {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  return typeof payload?.exp === 'number' && payload.exp * 1000 > Date.now();
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem('token');
    return isTokenValid(stored) ? stored : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => isTokenValid(localStorage.getItem('token')));

  const login = useCallback((newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    // 이미 만료된 토큰이 로컬에 남아있으면 정리한다.
    const stored = localStorage.getItem('token');
    if (stored && !isTokenValid(stored)) {
      localStorage.removeItem('token');
    }
  }, []);

  useEffect(() => {
    // client.js의 401 처리가 이 logout()을 그대로 호출하도록 등록해 로그아웃 경로를 하나로 합친다.
    registerLogoutHandler(logout);
  }, [logout]);

  useEffect(() => {
    // 다른 탭에서 로그인/로그아웃하면 localStorage 변경이 storage 이벤트로 전달된다.
    const handleStorage = (event) => {
      if (event.key !== 'token') return;
      if (isTokenValid(event.newValue)) {
        setToken(event.newValue);
        setIsAuthenticated(true);
      } else {
        setToken(null);
        setIsAuthenticated(false);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(
    () => ({ token, isAuthenticated, login, logout }),
    [token, isAuthenticated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Provider와 그 짝인 훅을 같은 파일에 두는 관례이며, 이 훅 하나만을 위해 파일을
// 분리하면 Context/Provider/훅 세 파일로 흩어져 오히려 추적하기 어려워진다.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
