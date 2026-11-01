import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import client from '../../../api/client';
import IncorrectNoteModal from './IncorrectNoteModal';
import QuestionComments from '../../quiz/QuestionComments';
import { showAlert } from '../../../context/ConfirmContext';
import '../../../pages/QuizLibraryPage.css';
import './CBTPlayer.css';

// sharedQuizId: CBT 시험 공유게시판에서 연 경우에만 넘어오며, 결과 화면에 문제별 댓글을 보여 준다.
const CBTPlayer = ({ quizData, onClose, courseId, mode = 'solve', initialAnswers = null, sharedQuizId = null }) => {
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [submitted, setSubmitted] = useState(mode === 'report');
  const [isSaving, setIsSaving] = useState(false);
  
  // 신규: 오답노트 모달 관련 상태
  const [isIncorrectModalOpen, setIsIncorrectModalOpen] = useState(false);
  const [targetQuestionId, setTargetQuestionId] = useState(null);

  const scrollRef = useRef(null);

  // 공유 시험 댓글은 제출 후 결과 화면에서만 보여 준다(풀이 중 정답 노출 방지). 글 전체를 한 번에 받는다.
  const [commentsByQuestion, setCommentsByQuestion] = useState({});
  useEffect(() => {
    if (!submitted || !sharedQuizId) return;
    client.get(`/shared-quizzes/${sharedQuizId}/comments`)
      .then(res => setCommentsByQuestion(res.data || {}))
      .catch(err => console.error('댓글을 불러오지 못했습니다.', err));
  }, [submitted, sharedQuizId]);

  // 리포트 모드일 경우 questions 구조가 다를 수 있으므로 정규화
  const questions = mode === 'report' && quizData.userAnswers 
    ? quizData.userAnswers.map(ua => ({ ...ua.question, submittedAnswer: ua.submittedAnswer, isCorrect: ua.isCorrect }))
    : quizData.questions;

  const currentQuestion = questions[currentIdx];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, 0);
    }
  }, [currentIdx, submitted]);

  const handleSelect = (option) => {
    if (submitted) return;
    setAnswers({ ...answers, [currentIdx]: option });
  };

  // 서버 채점(QuizService.isAnswerCorrect)과 같은 규칙이므로 바꿀 때 함께 수정한다.
  // 객관식·OX는 trim + 소문자, 주관식은 추가로 모든 공백과 앞뒤 문장부호를 무시한다.
  const normalizeAnswer = (type, value) => {
    const base = String(value ?? '').trim().toLowerCase();
    return type === 'SHORT_ANSWER'
      ? base.replace(/\s+/g, '').replace(/^[.,!?;:'"“”‘’。]+|[.,!?;:'"“”‘’。]+$/g, '')
      : base;
  };
  const isCorrectAt = (q, idx) => normalizeAnswer(q.type, answers[idx]) === normalizeAnswer(q.type, q.correctAnswer);

  const handleSubmit = async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      // 서버가 실제 정답과 대조해 score/isCorrect를 직접 계산하므로(QuizService.saveAttempt),
      // 신뢰할 수 없는 클라이언트 계산값은 요청에 담지 않는다.
      const userAnswers = questions.map((q, idx) => ({
        questionId: q.questionId,
        submittedAnswer: String(answers[idx] || '')
      }));

      await client.post('/quiz/attempts', {
        quizSetId: quizData.quizSetId,
        userAnswers: userAnswers
      });

      setSubmitted(true);
    } catch (error) {
      // 저장에 실패하면 결과 화면으로 넘기지 않는다. 답안이 남아 있어 다시 제출할 수 있다.
      console.error("결과 저장 실패:", error);
      showAlert(error.response?.data?.message || '풀이 결과를 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewSource = (q) => {
    if (!courseId) {
      showAlert('출처 강의 정보를 찾을 수 없습니다.');
      return;
    }
    if (!q.sourceNoteId || !q.sourceBlockId) {
      showAlert('출처 정보를 찾을 수 없습니다.');
      return;
    }
    navigate(`/course/${courseId}/note/${q.sourceNoteId}`, {
      state: {
        sourceBlockId: q.sourceBlockId,
      },
    });
    onClose();
  };

  // 결과 리포트 화면 (제출 완료 또는 리포트 모드)
  if (submitted) {
    const score = mode === 'report' ? quizData.score : questions.filter(isCorrectAt).length;
    const total = questions.length;

    return (
      <div className="cbt">
        <IncorrectNoteModal
          isOpen={isIncorrectModalOpen}
          onClose={() => setIsIncorrectModalOpen(false)}
          questionId={targetQuestionId}
        />
        <div className="cbt-scroll custom-scrollbar" ref={scrollRef}>
          <div className="cbt-col cbt-report">
            <header className="cbt-score-head">
              <h2 className="cbt-report-title">{mode === 'report' ? '과거 학습 결과' : '학습 결과 리포트'}</h2>
              <p className="cbt-score">{score} / {total} 점</p>
              {mode === 'report' && (
                <p className="cbt-score-date">풀이 일시: {new Date(quizData.createdAt).toLocaleString()}</p>
              )}
            </header>

            {questions.map((q, idx) => {
              const userAnswer = mode === 'report' ? q.submittedAnswer : (answers[idx] || '');
              const isCorrect = mode === 'report' ? q.isCorrect : isCorrectAt(q, idx);
              const choices = q.type === 'OX' ? ['O', 'X'] : (q.options || []);

              return (
                <article key={idx} className="cbt-result">
                  <div className="cbt-result-head">
                    <p className="cbt-result-meta">
                      문제 {idx + 1}
                      <span className={isCorrect ? 'cbt-is-correct' : 'cbt-is-wrong'}>{isCorrect ? '정답' : '오답'}</span>
                    </p>
                    <div className="cbt-result-actions">
                      {q.sourceBlockId && (
                        <button onClick={() => handleViewSource(q)} className="lib-btn">
                          원문 보기
                        </button>
                      )}
                      {!isCorrect && (
                        <button
                          onClick={() => {
                            setTargetQuestionId(q.questionId);
                            setIsIncorrectModalOpen(true);
                          }}
                          className="lib-btn"
                        >
                          오답노트 담기
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="cbt-result-question">{q.questionText}</h3>
                  {q.type === 'SHORT_ANSWER' ? (
                    <dl className="cbt-answers">
                      <div className={`cbt-answer ${isCorrect ? 'cbt-answer-correct' : 'cbt-answer-wrong'}`}>
                        <dt className="cbt-answer-label">내 답변:</dt>
                        <dd className="cbt-answer-text">{userAnswer || '(입력 없음)'}</dd>
                      </div>
                      {!isCorrect && (
                        <div className="cbt-answer cbt-answer-correct">
                          <dt className="cbt-answer-label">정답:</dt>
                          <dd className="cbt-answer-text">{q.correctAnswer}</dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <ul className="cbt-answers">
                      {choices.map((opt, i) => (
                        <li
                          key={i}
                          className={`cbt-answer ${opt === q.correctAnswer ? 'cbt-answer-correct' : userAnswer === opt ? 'cbt-answer-wrong' : ''}`}
                        >
                          <span className="cbt-answer-text">{opt}</span>
                          <span className="cbt-answer-tags">
                            {userAnswer === opt && <span>내 답</span>}
                            {opt === q.correctAnswer && <span>정답</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.conceptTags?.length > 0 && (
                    <div className="cbt-tags" aria-label="개념 태그">
                      {q.conceptTags.map(tag => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </div>
                  )}
                  <p className="cbt-explanation">
                    <strong>해설: </strong>{q.explanation}
                  </p>
                  {sharedQuizId && (
                    <QuestionComments
                      addUrl={`/shared-quizzes/${sharedQuizId}/questions/${q.questionId}/comments`}
                      commentUrl="/shared-quizzes/comments"
                      placeholder="이 문제에 대한 질문이나 풀이를 남겨 보세요 (익명)"
                      comments={commentsByQuestion[q.questionId] || []}
                      onChange={(list) => setCommentsByQuestion(prev => ({ ...prev, [q.questionId]: list }))}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </div>
        <footer className="cbt-footer">
          <div className="cbt-col cbt-footer-row cbt-footer-end">
            <button onClick={onClose} className="lib-btn lib-btn-primary">학습 완료</button>
          </div>
        </footer>
      </div>
    );
  }

  // 문제 풀이 화면
  return (
    <div className="cbt">
      <header className="cbt-header">
        <div className="cbt-col cbt-header-row">
          <h2 className="cbt-title">{quizData.title}</h2>
          <span className="cbt-difficulty">{quizData.difficulty}</span>
          <button onClick={onClose} className="lib-btn">종료</button>
        </div>
        <div className="cbt-progress" aria-hidden="true">
          <span className="cbt-progress-fill" style={{ transform: `scaleX(${(currentIdx + 1) / questions.length})` }} />
        </div>
      </header>

      <div className="cbt-scroll custom-scrollbar" ref={scrollRef}>
        <div className="cbt-col cbt-solve">
          <h3 className="cbt-question">{currentQuestion?.questionText}</h3>

          {currentQuestion?.type === 'SHORT_ANSWER' ? (
            <input
              type="text"
              className="cbt-input"
              placeholder="정답을 입력하세요..."
              // user_answers.submitted_answer(VARCHAR 255)와 QuizAttemptRequest의 @Size와 같다.
              maxLength={255}
              value={answers[currentIdx] || ''}
              onChange={(e) => handleSelect(e.target.value)}
            />
          ) : currentQuestion?.type === 'OX' ? (
            <div className="cbt-ox">
              {['O', 'X'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  aria-pressed={answers[currentIdx] === opt}
                  className="cbt-ox-option"
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className="cbt-options">
              {currentQuestion?.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(opt)}
                  aria-pressed={answers[currentIdx] === opt}
                  className="cbt-option"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="cbt-footer">
        <div className="cbt-col cbt-footer-row">
          <button
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(currentIdx - 1)}
            className="lib-btn"
          >
            이전
          </button>

          <span className="cbt-count">문제 {currentIdx + 1} / {questions.length}</span>

          {currentIdx === questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="lib-btn lib-btn-primary"
            >
              {isSaving && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />}
              제출하고 채점하기
            </button>
          ) : (
            <button
              onClick={() => setCurrentIdx(currentIdx + 1)}
              className="lib-btn lib-btn-primary"
            >
              다음 문제
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default CBTPlayer;
