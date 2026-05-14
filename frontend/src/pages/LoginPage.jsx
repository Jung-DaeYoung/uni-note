import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [studentNum, setStudentNum] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await client.post('/auth/login', { studentNum, password });
      const { token } = response.data;
      login(token);
      navigate('/dashboard');
    } catch (error) {
      const errorMessage = error.response?.data?.message || '로그인에 실패했습니다. 학번과 비밀번호를 확인해주세요.';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <div className="max-w-sm w-full bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-blue-600 mb-2">UniNote</h1>
          <p className="text-slate-500 font-medium text-sm">서비스 이용을 위해 로그인해주세요.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Student ID</label>
            <input
              type="text"
              value={studentNum}
              onChange={(e) => setStudentNum(e.target.value)}
              placeholder="학번을 입력하세요"
              className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-5 text-slate-900 font-semibold placeholder:text-slate-300 focus:bg-white focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 px-5 text-slate-900 font-semibold placeholder:text-slate-300 focus:bg-white focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-70"
          >
            {isLoading ? '인증 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
