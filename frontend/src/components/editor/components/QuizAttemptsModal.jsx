import React, { useEffect, useState } from 'react';
import { X, History, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import client from '../../../api/client';

const QuizAttemptsModal = ({ isOpen, onClose, quizSetId, quizTitle, onViewAttempt }) => {
  const [attempts, setAttempts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && quizSetId) {
      fetchAttempts();
    }
  }, [isOpen, quizSetId]);

  const fetchAttempts = async () => {
    setIsLoading(true);
    try {
      const res = await client.get(`/quiz/${quizSetId}/attempts`);
      setAttempts(res.data);
    } catch (err) {
      console.error("시도 기록 조회 실패:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <History size={20} className="text-blue-600" />
              풀이 기록
            </h2>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5 line-clamp-1">{quizTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold text-slate-400 text-center">기록을 불러오는 중...</p>
            </div>
          ) : attempts.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <History size={32} className="text-slate-200" />
              </div>
              <p className="text-sm font-bold text-slate-400">아직 풀이 기록이 없습니다.</p>
              <p className="text-[11px] font-bold text-slate-300 mt-1">먼저 문제를 풀어보세요!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attempts.map((attempt) => (
                <div 
                  key={attempt.attemptId}
                  onClick={() => onViewAttempt(attempt.attemptId)}
                  className="group bg-white border border-slate-100 p-4 rounded-2xl hover:border-blue-200 hover:shadow-md hover:shadow-blue-50 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                      attempt.score === attempt.totalQuestions ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-700 group-hover:text-blue-600 transition-colors">
                        {attempt.score} / {attempt.totalQuestions} 문제 맞춤
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 size={10} className="text-emerald-500" />
                        {new Date(attempt.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-slate-50/50 border-t border-slate-50">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98]"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizAttemptsModal;
