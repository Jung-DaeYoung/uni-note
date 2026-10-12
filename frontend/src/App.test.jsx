import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';

vi.mock('./pages/LoginPage', () => ({ default: () => <div>LOGIN_PAGE</div> }));
vi.mock('./pages/DashboardPage', () => ({ default: () => <div>DASHBOARD_PAGE</div> }));
vi.mock('./pages/CourseDetailPage', () => ({ default: () => <div>COURSE_DETAIL_PAGE</div> }));
vi.mock('./pages/QuizLibraryPage', () => ({ default: () => <div>QUIZ_LIBRARY_PAGE</div> }));
vi.mock('./pages/IncorrectNotesPage', () => ({ default: () => <div>INCORRECT_NOTES_PAGE</div> }));

// AuthContext.test.jsx와 동일한 패턴을 중복 사용한다 (공유 test-util 모듈은 아직 없음).
const makeToken = (expSecondsFromNow) => {
  const payload = { sub: '2021001', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  const base64url = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256' })}.${base64url(payload)}.signature`;
};

const setPath = (path) => window.history.pushState({}, '', path);

const renderAppAt = (path) => {
  setPath(path);
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
};

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear();
    setPath('/');
  });

  afterEach(() => {
    localStorage.clear();
    setPath('/');
  });

  it('비로그인 사용자의 /dashboard 접근은 /login으로 이동한다', async () => {
    renderAppAt('/dashboard');

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('인증 사용자의 /dashboard 접근은 Dashboard를 표시한다', async () => {
    localStorage.setItem('token', makeToken(3600));
    renderAppAt('/dashboard');

    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument();
  });

  it('인증 상태에서 /course/:courseId에 직접 접근할 수 있다', async () => {
    localStorage.setItem('token', makeToken(3600));
    renderAppAt('/course/123');

    expect(await screen.findByText('COURSE_DETAIL_PAGE')).toBeInTheDocument();
  });

  it('인증 상태에서 /course/:courseId/note/:noteId에 직접 접근할 수 있다', async () => {
    localStorage.setItem('token', makeToken(3600));
    renderAppAt('/course/123/note/456');

    expect(await screen.findByText('COURSE_DETAIL_PAGE')).toBeInTheDocument();
  });

  it('인증 상태에서 /quizzes에 직접 접근할 수 있다', async () => {
    localStorage.setItem('token', makeToken(3600));
    renderAppAt('/quizzes');

    expect(await screen.findByText('QUIZ_LIBRARY_PAGE')).toBeInTheDocument();
  });

  it('비로그인 사용자의 /incorrect-notes 접근은 /login으로 이동한다', async () => {
    renderAppAt('/incorrect-notes');

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('인증 상태에서 /incorrect-notes에 직접 접근할 수 있다', async () => {
    localStorage.setItem('token', makeToken(3600));
    renderAppAt('/incorrect-notes');

    expect(await screen.findByText('INCORRECT_NOTES_PAGE')).toBeInTheDocument();
  });

  it('인증 상태에서 /incorrect-notes/groups에 직접 접근할 수 있다', async () => {
    localStorage.setItem('token', makeToken(3600));
    renderAppAt('/incorrect-notes/groups');

    expect(await screen.findByText('INCORRECT_NOTES_PAGE')).toBeInTheDocument();
  });

  it('인증 상태에서 /login 접근은 /dashboard로 이동한다', async () => {
    localStorage.setItem('token', makeToken(3600));
    renderAppAt('/login');

    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });
});
