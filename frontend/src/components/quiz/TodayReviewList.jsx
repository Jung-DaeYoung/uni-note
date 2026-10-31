import React from 'react';
import { ExternalLink } from 'lucide-react';

// 간격 반복 일정 표시. nextReviewAt(YYYY-MM-DD)이 오늘보다 이전이면 밀린 일수를 보여 준다.
const scheduleLabel = (item) => {
  if (!item.nextReviewAt) return null;
  const [y, m, d] = item.nextReviewAt.split('-').map(Number);
  const today = new Date();
  const overdueDays = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(y, m - 1, d)) / 86400000
  );
  return overdueDays > 0 ? `${overdueDays}일 밀림` : '오늘 복습';
};

const TodayReviewList = ({
  items,
  isLoading,
  courseOptions,
  courseFilter,
  onCourseFilterChange,
  onViewSource,
  onPracticeOne,
}) => {
  return (
    <section className="inc-section">
      <div className="inc-heading-row">
        <h2 className="lib-heading">오늘의 복습</h2>
        {courseOptions.length > 0 && (
          <select
            value={courseFilter ?? ''}
            onChange={(e) => onCourseFilterChange(e.target.value ? Number(e.target.value) : null)}
            aria-label="복습할 강의 선택"
            className="lib-select"
          >
            <option value="">전체 강의</option>
            {courseOptions.map((c) => (
              <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <p className="lib-loading">
          <span className="lib-spinner" aria-hidden="true" />
          복습 목록을 불러오는 중…
        </p>
      ) : items.length === 0 ? (
        <p className="lib-empty">오늘 복습할 문제를 모두 끝냈어요.</p>
      ) : (
        <ul className="lib-list">
          {items.map((item) => (
            <li key={item.question.questionId} className="lib-quiz">
              <div className="lib-quiz-body">
                <p className="lib-item-title inc-question">{item.question.questionText}</p>
                <p className="lib-meta">
                  {item.courseName && <span>{item.courseName}</span>}
                  <span className={item.incorrectCount >= 2 ? 'inc-repeat' : undefined}>
                    {item.incorrectCount >= 2 ? `반복 오답 ${item.incorrectCount}회` : `오답 ${item.incorrectCount}회`}
                  </span>
                  {scheduleLabel(item) && <span>{scheduleLabel(item)}</span>}
                  {scheduleLabel(item) && item.streak > 0 && <span>연속 정답 {item.streak}회</span>}
                </p>
              </div>
              <div className="lib-actions">
                {/* 공유게시판 문제처럼 출처가 없는 문제는 원문 보기를 숨긴다(CBTPlayer와 동일). */}
                {item.question.sourceBlockId && (
                  <button
                    onClick={() => onViewSource(item)}
                    className="lib-icon"
                    title="원문 보기"
                    aria-label="원문 보기"
                  >
                    <ExternalLink size={16} />
                  </button>
                )}
                <button onClick={() => onPracticeOne(item)} className="lib-btn lib-btn-primary">
                  다시 풀기
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default TodayReviewList;
