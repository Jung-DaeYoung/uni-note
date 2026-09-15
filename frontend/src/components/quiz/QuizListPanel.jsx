import React from 'react';
import { BrainCircuit, Calendar, Search, Trash2 } from 'lucide-react';

const QuizListPanel = ({ quizzes, onRetake, onOpenAttempts, onDelete }) => {
  if (quizzes.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-2 text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <BrainCircuit size={48} className="mx-auto mb-4 text-slate-200 dark:text-slate-700" />
          <p className="font-bold text-slate-400 dark:text-slate-500 text-sm">아직 생성된 퀴즈가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {quizzes.map(quiz => (
        <div key={quiz.quizSetId} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-black px-2 py-1 bg-blue-600 text-white rounded-lg uppercase tracking-tight shadow-sm shadow-blue-200 dark:shadow-none">
              {quiz.courseName}
            </span>
          </div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{quiz.title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg">{quiz.difficulty}</span>
              <button onClick={(e) => onDelete(e, quiz.quizSetId)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-6 font-bold flex items-center gap-1">
            <Calendar size={12} />
            생성일: {new Date(quiz.createdAt).toLocaleDateString()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onRetake(quiz)}
              className="flex-1 py-2.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 transition-all active:scale-[0.98] shadow-sm"
            >
              다시 풀기
            </button>
            <button
              onClick={() => onOpenAttempts(quiz)}
              className="flex-1 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <Search size={14} />
              결과 확인
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuizListPanel;
