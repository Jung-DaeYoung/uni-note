import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setIsAuthenticated(true);
  };

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

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
