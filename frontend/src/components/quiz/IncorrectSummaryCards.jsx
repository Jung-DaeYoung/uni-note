import React from 'react';

const IncorrectSummaryCards = ({ summary, todayReviewCount, savedCount, isLoading }) => {
  const cards = [
    {
      key: 'accuracy',
      label: '전체 정답률',
      value: summary ? `${Math.round(summary.accuracyRate * 100)}%` : '-',
    },
    {
      key: 'repeat',
      label: '반복 오답',
      value: summary ? summary.repeatIncorrectCount : '-',
    },
    {
      key: 'today',
      label: '오늘의 복습',
      value: todayReviewCount,
      accent: true,
    },
    {
      key: 'saved',
      label: '저장된 오답',
      value: savedCount,
    },
  ];

  return (
    <div className="inc-stats">
      {cards.map((card) => (
        <div key={card.key} className="inc-stat">
          <span className={`inc-stat-value ${card.accent ? 'inc-stat-accent' : ''}`}>
            {isLoading ? '…' : card.value}
          </span>
          <span className="inc-stat-label">{card.label}</span>
        </div>
      ))}
    </div>
  );
};

export default IncorrectSummaryCards;
