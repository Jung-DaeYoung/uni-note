import React from 'react';
import { BrainCircuit, Calendar, Search, Trash2 } from 'lucide-react';

const QuizListPanel = ({ quizzes, onRetake, onOpenAttempts, onDelete }) => {
  if (quizzes.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-2 text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <BrainCircuit size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="font-bold text-slate-400 text-sm">아직 생성된 퀴즈가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {quizzes.map(quiz => (
        <div key={quiz.quizSetId} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-black px-2 py-1 bg-blue-600 text-white rounded-lg uppercase tracking-tight shadow-sm shadow-blue-200">
              {quiz.courseName}
            </span>
          </div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{quiz.title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">{quiz.difficulty}</span>
              <button onClick={(e) => onDelete(e, quiz.quizSetId)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mb-6 font-bold flex items-center gap-1">
            <Calendar size={12} />
            생성일: {new Date(quiz.createdAt).toLocaleDateString()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onRetake(quiz)}
              className="flex-1 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98] shadow-sm"
            >
              다시 풀기
            </button>
            <button
              onClick={() => onOpenAttempts(quiz)}
              className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
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
