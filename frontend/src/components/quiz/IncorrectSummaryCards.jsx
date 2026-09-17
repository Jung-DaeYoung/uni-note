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
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const CardIcon = card.icon;
        return (
          <div
            key={card.key}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${card.color}`}>
              <CardIcon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tight truncate">
                {card.label}
              </p>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">
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
