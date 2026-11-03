import React, { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import client from '../../../api/client';
import '../../../pages/QuizLibraryPage.css';
import './QuizAttemptsModal.css';

const QuizAttemptsModal = ({ isOpen, onClose, quizSetId, quizTitle, onViewAttempt }) => {
  const [attempts, setAttempts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const titleId = useId();

  // 모달이 열릴 때 서버 목록을 새로 불러오는 표준 fetch-on-open 패턴이다.
  useEffect(() => {
    if (!isOpen || !quizSetId) return;
    const fetchAttempts = async () => {
      setIsLoading(true);
      try {
        const res = await client.get(`/quiz/${quizSetId}/attempts`);
        setAttempts(res.data);
      } catch (err) {
        console.error("시도 기록 조회 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAttempts();
  }, [isOpen, quizSetId]);

  if (!isOpen) return null;

  return (
    <div className="att-overlay">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="att">
        <div className="att-head">
          <div className="att-heading">
            <h2 id={titleId} className="cf-title">풀이 기록</h2>
            <p className="att-quiz">{quizTitle}</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="lib-icon cf-close">
            <X size={18} />
          </button>
        </div>

        <div className="att-body">
          {isLoading ? (
            <p className="lib-loading">
              <span className="lib-spinner" aria-hidden="true" />
              기록을 불러오는 중…
            </p>
          ) : attempts.length === 0 ? (
            <p className="lib-empty">
              아직 풀이 기록이 없습니다.
              <span className="att-hint">먼저 문제를 풀어보세요!</span>
            </p>
          ) : (
            <ul className="lib-list">
              {attempts.map((attempt) => (
                <li key={attempt.attemptId} className="lib-attempt">
                  <button onClick={() => onViewAttempt(attempt.attemptId)} className="lib-attempt-main">
                    <span className={`lib-score ${attempt.score === attempt.totalQuestions ? 'is-perfect' : ''}`}>
                      {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
                    </span>
                    <span className="lib-attempt-body">
                      <span className="lib-item-title">{attempt.score} / {attempt.totalQuestions} 문제 맞춤</span>
                      <span className="lib-meta">
                        <span>{new Date(attempt.createdAt).toLocaleString()}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="att-foot">
          <button onClick={onClose} className="lib-btn lib-btn-primary">확인</button>
        </div>
      </div>
    </div>
  );
};

export default QuizAttemptsModal;
