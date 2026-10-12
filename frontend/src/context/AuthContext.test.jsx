import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';

// 서명은 검증하지 않고 payload.exp만 디코드하므로, base64url로 인코딩된 payload만
// 실제 형식과 맞으면 된다. 헤더/서명 부분은 형식을 맞추기 위한 더미 값이다.
const makeToken = (expSecondsFromNow) => {
  const payload = { sub: '2021001', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  const base64url = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256' })}.${base64url(payload)}.signature`;
};

const Consumer = () => {
  const { isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <button onClick={() => login(makeToken(3600))}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
};

const LoginButton = ({ token }) => {
  const { login } = useAuth();
  return <button onClick={() => login(token)}>login-with-token</button>;
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('localStorage에 유효한 토큰이 없으면 미인증 상태로 시작한다', () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('localStorage에 만료된 토큰이 있으면 미인증 상태로 시작하고 토큰을 정리한다', () => {
    localStorage.setItem('token', makeToken(-3600));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('localStorage에 유효한 토큰이 있으면 인증 상태로 시작한다', () => {
    localStorage.setItem('token', makeToken(3600));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
  });

  it('login()은 토큰을 저장하고 인증 상태로 전환한다', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await user.click(screen.getByText('login'));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(localStorage.getItem('token')).not.toBeNull();
  });

  it('logout()은 토큰을 지우고 미인증 상태로 전환한다', async () => {
    localStorage.setItem('token', makeToken(3600));
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');

    await user.click(screen.getByText('logout'));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('login()은 형식이 잘못된 토큰을 저장하지 않는다', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
        <LoginButton token="not-a-valid-jwt" />
      </AuthProvider>
    );

    await user.click(screen.getByText('login-with-token'));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('login()은 만료된 토큰을 저장하지 않는다', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
        <LoginButton token={makeToken(-3600)} />
      </AuthProvider>
    );

    await user.click(screen.getByText('login-with-token'));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('이미 인증된 상태에서 유효하지 않은 토큰으로 login()을 호출해도 기존 세션이 유지된다', async () => {
    const validToken = makeToken(3600);
    localStorage.setItem('token', validToken);
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Consumer />
        <LoginButton token="not-a-valid-jwt" />
      </AuthProvider>
    );
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');

    await user.click(screen.getByText('login-with-token'));

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(localStorage.getItem('token')).toBe(validToken);
  });

  it('다른 탭에서 로그인하면 storage 이벤트로 인증 상태가 동기화된다', () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');

    const newToken = makeToken(3600);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: newToken }));
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
  });
});
