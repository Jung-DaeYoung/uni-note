import React from 'react';

const TYPE_LABELS = {
  MULTIPLE_CHOICE: '객관식',
  OX: 'OX 퀴즈',
  SHORT_ANSWER: '주관식',
};

const AccuracyBar = ({ accuracyRate }) => (
  <div className="inc-bar">
    <span
      className={accuracyRate < 0.5 ? 'inc-bar-low' : accuracyRate < 0.75 ? 'inc-bar-mid' : 'inc-bar-high'}
      style={{ width: `${Math.round(accuracyRate * 100)}%` }}
    />
  </div>
);

// 개념 수가 많아질 수 있어 취약한 순(서버 정렬)으로 앞부분만 보여준다.
const MAX_CONCEPTS = 8;

const WeakAreaBreakdown = ({ courseStats, typeStats, conceptStats = [], isLoading }) => {
  return (
    <div className="inc-weak">
      <section className="inc-section">
        <h2 className="lib-heading">취약 강의</h2>
        {isLoading ? (
          <p className="lib-empty">불러오는 중…</p>
        ) : courseStats.length === 0 ? (
          <p className="lib-empty">아직 풀이 기록이 없습니다.</p>
        ) : (
          <ul className="inc-bars">
            {courseStats.map((c) => (
              <li key={c.courseId}>
                <div className="inc-bar-head">
                  <span className="inc-bar-name">{c.courseName}</span>
                  <span className="inc-bar-value">{Math.round(c.accuracyRate * 100)}%</span>
                </div>
                <AccuracyBar accuracyRate={c.accuracyRate} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="inc-section">
        <h2 className="lib-heading">취약 유형</h2>
        {isLoading ? (
          <p className="lib-empty">불러오는 중…</p>
        ) : typeStats.length === 0 ? (
          <p className="lib-empty">아직 풀이 기록이 없습니다.</p>
        ) : (
          <ul className="inc-bars">
            {typeStats.map((t) => (
              <li key={t.type}>
                <div className="inc-bar-head">
                  <span className="inc-bar-name">{TYPE_LABELS[t.type] || t.type}</span>
                  <span className="inc-bar-value">{Math.round(t.accuracyRate * 100)}%</span>
                </div>
                <AccuracyBar accuracyRate={t.accuracyRate} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="inc-section inc-section-wide">
        <h2 className="lib-heading">취약 개념</h2>
        {isLoading ? (
          <p className="lib-empty">불러오는 중…</p>
        ) : conceptStats.length === 0 ? (
          <p className="lib-empty">개념 태그가 있는 문제를 풀면 표시됩니다.</p>
        ) : (
          <ul className="inc-bars inc-bars-wide">
            {conceptStats.slice(0, MAX_CONCEPTS).map((c) => (
              <li key={`${c.courseId}-${c.conceptTag}`}>
                <div className="inc-bar-head">
                  <span className="inc-bar-name">
                    {c.conceptTag}
                    {c.courseName && <span className="inc-bar-course">{c.courseName}</span>}
                  </span>
                  <span className="inc-bar-value">
                    {Math.round(c.accuracyRate * 100)}% · {c.attemptCount}회
                  </span>
                </div>
                <AccuracyBar accuracyRate={c.accuracyRate} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default WeakAreaBreakdown;
