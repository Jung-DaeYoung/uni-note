import React from 'react';
import { BookOpen, ListChecks } from 'lucide-react';

const TYPE_LABELS = {
  MULTIPLE_CHOICE: '객관식',
  OX: 'OX 퀴즈',
  SHORT_ANSWER: '주관식',
};

const AccuracyBar = ({ accuracyRate }) => (
  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full ${accuracyRate < 0.5 ? 'bg-red-400 dark:bg-red-500' : accuracyRate < 0.75 ? 'bg-amber-400 dark:bg-amber-500' : 'bg-emerald-400 dark:bg-emerald-500'}`}
      style={{ width: `${Math.round(accuracyRate * 100)}%` }}
    />
  </div>
);

const WeakAreaBreakdown = ({ courseStats, typeStats, isLoading }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-slate-500 dark:text-slate-400" />
          취약 강의
        </h3>
        {isLoading ? (
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 py-6 text-center">불러오는 중...</p>
        ) : courseStats.length === 0 ? (
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 py-6 text-center">아직 풀이 기록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {courseStats.map((c) => (
              <div key={c.courseId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{c.courseName}</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                    {Math.round(c.accuracyRate * 100)}%
                  </span>
                </div>
                <AccuracyBar accuracyRate={c.accuracyRate} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <ListChecks size={16} className="text-slate-500 dark:text-slate-400" />
          취약 유형
        </h3>
        {isLoading ? (
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 py-6 text-center">불러오는 중...</p>
        ) : typeStats.length === 0 ? (
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 py-6 text-center">아직 풀이 기록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {typeStats.map((t) => (
              <div key={t.type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {TYPE_LABELS[t.type] || t.type}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                    {Math.round(t.accuracyRate * 100)}%
                  </span>
                </div>
                <AccuracyBar accuracyRate={t.accuracyRate} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeakAreaBreakdown;
