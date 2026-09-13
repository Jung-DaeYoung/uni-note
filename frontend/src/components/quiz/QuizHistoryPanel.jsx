import React from 'react';
import { CheckCircle2, ChevronRight, History } from 'lucide-react';

const QuizHistoryPanel = ({ attempts, isLoading, onViewAttempt }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="text-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm font-bold text-slate-400">기록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <History size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="font-bold text-slate-400 text-sm">아직 풀이 기록이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {attempts.map(attempt => (
        <div
          key={attempt.attemptId}
          onClick={() => onViewAttempt(attempt.attemptId)}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm ${attempt.score === attempt.totalQuestions ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
              {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
            </div>
            <div>
              <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{attempt.quizTitle}</h3>
              <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
                <CheckCircle2 size={12} className="text-emerald-500" />
                {attempt.score} / {attempt.totalQuestions} 문제 맞춤 • {new Date(attempt.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
        </div>
      ))}
    </div>
  );
};

export default QuizHistoryPanel;
