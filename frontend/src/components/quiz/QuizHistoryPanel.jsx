import React from 'react';
import { Trash2 } from 'lucide-react';

const QuizHistoryPanel = ({ attempts, isLoading, onViewAttempt, onDelete }) => {
  if (isLoading) {
    return (
      <p className="lib-loading">
        <span className="lib-spinner" aria-hidden="true" />
        기록을 불러오는 중…
      </p>
    );
  }

  if (attempts.length === 0) {
    return <p className="lib-empty">아직 풀이 기록이 없습니다.</p>;
  }

  return (
    <ul className="lib-list lib-history">
      {attempts.map(attempt => (
        <li key={attempt.attemptId} className="lib-attempt">
          <button onClick={() => onViewAttempt(attempt.attemptId)} className="lib-attempt-main">
            <span className={`lib-score ${attempt.score === attempt.totalQuestions ? 'is-perfect' : ''}`}>
              {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
            </span>
            <span className="lib-attempt-body">
              <span className="lib-item-title">{attempt.quizTitle}</span>
              <span className="lib-meta">
                <span>{attempt.score} / {attempt.totalQuestions} 문제 맞춤</span>
                <span>{new Date(attempt.createdAt).toLocaleString()}</span>
              </span>
            </span>
          </button>
          <button
            onClick={(e) => onDelete(e, attempt.attemptId)}
            title="풀이 기록 삭제"
            aria-label={`${attempt.quizTitle} 풀이 기록 삭제`}
            className="lib-icon lib-icon-danger"
          >
            <Trash2 size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
};

export default QuizHistoryPanel;
