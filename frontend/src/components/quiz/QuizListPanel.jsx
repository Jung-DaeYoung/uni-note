import React from 'react';
import { PenLine, Share2, Trash2 } from 'lucide-react';

// 서버가 준 순서를 유지한 채 강의별로 묶는다.
const groupByCourse = (quizzes) => {
  const groups = new Map();
  quizzes.forEach((quiz) => {
    if (!groups.has(quiz.courseName)) groups.set(quiz.courseName, []);
    groups.get(quiz.courseName).push(quiz);
  });
  return [...groups];
};

const QuizListPanel = ({ quizzes, onRetake, onOpenAttempts, onDelete, onShare, onRename }) => {
  if (quizzes.length === 0) {
    return <p className="lib-empty">아직 생성된 퀴즈가 없습니다.</p>;
  }

  return (
    <div>
      {groupByCourse(quizzes).map(([courseName, courseQuizzes]) => (
        <section key={courseName} className="lib-group">
          <h2 className="lib-heading">{courseName}</h2>
          <ul className="lib-list">
            {courseQuizzes.map(quiz => (
              <li key={quiz.quizSetId} className="lib-quiz">
                <div className="lib-quiz-body">
                  <h3 className="lib-item-title">{quiz.title}</h3>
                  <p className="lib-meta">
                    <span>{quiz.difficulty}</span>
                    <span>생성일: {new Date(quiz.createdAt).toLocaleDateString()}</span>
                    {quiz.shared && <span className="lib-shared">공유됨</span>}
                  </p>
                </div>
                <div className="lib-actions">
                  <div className="lib-icons">
                    <button
                      onClick={(e) => onRename(e, quiz)}
                      title="이름 변경"
                      aria-label={`${quiz.title} 이름 변경`}
                      className="lib-icon"
                    >
                      <PenLine size={16} />
                    </button>
                    {quiz.shared ? (
                      <span className="lib-icon-slot" aria-hidden="true" />
                    ) : (
                      <button
                        onClick={(e) => onShare(e, quiz)}
                        title="CBT 시험 공유게시판에 공유"
                        aria-label={`${quiz.title} CBT 시험 공유게시판에 공유`}
                        className="lib-icon"
                      >
                        <Share2 size={16} />
                      </button>
                    )}
                    <button
                      onClick={(e) => onDelete(e, quiz.quizSetId)}
                      title="퀴즈 삭제"
                      aria-label={`${quiz.title} 삭제`}
                      className="lib-icon lib-icon-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <button onClick={() => onOpenAttempts(quiz)} className="lib-btn">
                    결과 확인
                  </button>
                  <button onClick={() => onRetake(quiz)} className="lib-btn lib-btn-primary">
                    다시 풀기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default QuizListPanel;
