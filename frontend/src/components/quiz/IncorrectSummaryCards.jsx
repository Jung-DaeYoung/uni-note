import React from 'react';
import { Target, RotateCcw, CalendarCheck, Bookmark } from 'lucide-react';

const IncorrectSummaryCards = ({ summary, todayReviewCount, savedCount, isLoading }) => {
  const cards = [
    {
      key: 'accuracy',
      label: '전체 정답률',
      value: summary ? `${Math.round(summary.accuracyRate * 100)}%` : '-',
      icon: Target,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
    },
    {
      key: 'repeat',
      label: '반복 오답',
      value: summary ? summary.repeatIncorrectCount : '-',
      icon: RotateCcw,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    },
    {
      key: 'today',
      label: '오늘의 복습',
      value: todayReviewCount,
      icon: CalendarCheck,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      key: 'saved',
      label: '저장된 오답',
      value: savedCount,
      icon: Bookmark,
      color: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const CardIcon = card.icon;
        return (
          <div
            key={card.key}
            className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.color}`}>
              <CardIcon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 truncate">
                {card.label}
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {isLoading ? '...' : card.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default IncorrectSummaryCards;
