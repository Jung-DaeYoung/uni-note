import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const LoginPage = () => {
  const [studentNum, setStudentNum] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const studentNumRef = useRef(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await client.post('/auth/login', { studentNum, password });
      const { token } = response.data;
      login(token);
      navigate('/dashboard');
    } catch (error) {
      const errorMessage = error.response?.data?.message || '로그인에 실패했습니다. 학번과 비밀번호를 확인해주세요.';
      setError(errorMessage);
      studentNumRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-panel">
        <h1 className="login-wordmark">UniNote</h1>

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label htmlFor="login-student-num" className="login-label">학번</label>
            <input
              ref={studentNumRef}
              id="login-student-num"
              name="username"
              type="text"
              autoComplete="username"
              value={studentNum}
              onChange={(e) => setStudentNum(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              className="login-input"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password" className="login-label">비밀번호</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              className="login-input"
              required
            />
          </div>

          <div className="login-status">
            {error && (
              <p id="login-error" role="alert" className="login-error">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="login-submit"
          >
            {isLoading && <span className="login-spinner" aria-hidden="true" />}
            {isLoading ? '인증 중...' : '로그인'}
          </button>
        </form>
      </div>
    </main>
  );
};

export default LoginPage;
