import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, GraduationCap, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      {/* Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 flex overflow-hidden relative z-10 border border-slate-100">
        {/* Left Side: Branding/Visual */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-900 p-16 flex-col justify-between relative">
          <div className="absolute inset-0 opacity-20">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500 via-transparent to-transparent" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
                <span className="text-white font-black text-xl">U</span>
              </div>
              <span className="text-white font-black text-2xl tracking-tighter">UniNote</span>
            </div>
            <h2 className="text-4xl font-extrabold text-white leading-[1.1] mb-6">
              더 똑똑하게 기록하고,<br />
              <span className="text-blue-500 text-5xl">함께 성장하세요.</span>
            </h2>
            <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-sm">
              AI 기반 필기 요약부터 실시간 익명 소통까지, 대학 생활의 새로운 기준을 제시합니다.
            </p>
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4 text-slate-300">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                <GraduationCap size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-white">맞춤형 대시보드</p>
                <p className="text-sm text-slate-500">수강 중인 강의를 한눈에 관리</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-300">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                <Lock size={24} className="text-purple-400" />
              </div>
              <div>
                <p className="font-bold text-white">보안 및 익명성</p>
                <p className="text-sm text-slate-500">자유롭고 안전한 커뮤니티 공간</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full lg:w-1/2 p-12 lg:p-20 flex flex-col justify-center">
          <div className="max-w-sm mx-auto w-full">
            <div className="mb-10 text-center lg:text-left">
              <h3 className="text-3xl font-black text-slate-900 mb-2">반가워요! 👋</h3>
              <p className="text-slate-500 font-medium">서비스 이용을 위해 학번으로 로그인해주세요.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Student ID</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input
                    type="text"
                    value={studentNum}
                    onChange={(e) => setStudentNum(e.target.value)}
                    placeholder="학번을 입력하세요"
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-semibold placeholder:text-slate-300 focus:bg-white focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-semibold placeholder:text-slate-300 focus:bg-white focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-70"
              >
                {isLoading ? '인증 중...' : '로그인하기'}
                {!isLoading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
