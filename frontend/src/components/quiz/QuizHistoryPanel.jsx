import React from 'react';
import { CheckCircle2, ChevronRight, History } from 'lucide-react';

const QuizHistoryPanel = ({ attempts, isLoading, onViewAttempt }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="text-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500">기록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
          <History size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
          <p className="font-medium text-slate-400 dark:text-slate-500 text-sm">아직 풀이 기록이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attempts.map(attempt => (
        <div
          key={attempt.attemptId}
          onClick={() => onViewAttempt(attempt.attemptId)}
          className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center font-semibold text-sm ${attempt.score === attempt.totalQuestions ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
              {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{attempt.quizTitle}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1 mt-1">
                <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400" />
                {attempt.score} / {attempt.totalQuestions} 문제 맞춤 • {new Date(attempt.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all group-hover:translate-x-1" />
        </div>
      ))}
    </div>
  );
};

export default QuizHistoryPanel;
