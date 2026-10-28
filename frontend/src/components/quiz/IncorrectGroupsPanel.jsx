import React from 'react';
import { Bookmark, PenLine, PlayCircle, Trash2 } from 'lucide-react';

const IncorrectGroupsPanel = ({ incorrectGroups, isLoading, onPracticeIncorrect, onDeleteGroup, onRenameGroup }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-3 text-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500">오답노트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (incorrectGroups.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-3 text-center py-20 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
          <Bookmark size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
          <p className="font-medium text-slate-400 dark:text-slate-500 text-sm">아직 생성된 오답노트가 없습니다.</p>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-600 mt-1">퀴즈 풀이 결과에서 틀린 문제를 담아보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {incorrectGroups.map(group => (
        <div key={group.id} className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors group relative">
          <div className="flex justify-between items-start gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">{group.title}</h3>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={(e) => onRenameGroup(e, group)} title="이름 변경" className="text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                <PenLine size={14} />
              </button>
              <button onClick={(e) => onDeleteGroup(e, group.id)} title="오답노트 삭제" className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-6">{group.itemCount}개의 문항 저장됨</p>

          <button
            onClick={() => onPracticeIncorrect(group)}
            className="w-full py-2.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <PlayCircle size={14} />
            다시 풀기
          </button>
        </div>
      ))}
    </div>
  );
};

export default IncorrectGroupsPanel;
