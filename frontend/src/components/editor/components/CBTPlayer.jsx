import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, CheckCircle, XCircle, BookOpen, RotateCcw, ExternalLink, Loader2, Bookmark } from 'lucide-react';
import client from '../../../api/client';
import IncorrectNoteModal from './IncorrectNoteModal';

const CBTPlayer = ({ quizData, onClose, courseId, mode = 'solve', initialAnswers = null }) => {
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [submitted, setSubmitted] = useState(mode === 'report');
  const [isSaving, setIsSaving] = useState(false);
  
  // 신규: 오답노트 모달 관련 상태
  const [isIncorrectModalOpen, setIsIncorrectModalOpen] = useState(false);
  const [targetQuestionId, setTargetQuestionId] = useState(null);

  const scrollRef = useRef(null);

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

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      const userAnswer = String(answers[idx] || '').trim().toLowerCase();
      const correctAnswer = String(q.correctAnswer).trim().toLowerCase();
      if (userAnswer === correctAnswer) score++;
    });
    return score;
  };

  const handleSubmit = async () => {
    if (isSaving) return;
    
    const score = calculateScore();
    setIsSaving(true);
    
    try {
      const userAnswers = questions.map((q, idx) => ({
        questionId: q.questionId,
        submittedAnswer: String(answers[idx] || ''),
        isCorrect: String(answers[idx] || '').trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
      }));

      await client.post('/quiz/attempts', {
        quizSetId: quizData.quizSetId,
        score: score,
        userAnswers: userAnswers
      });
      
      setSubmitted(true);
    } catch (error) {
      console.error("결과 저장 실패:", error);
      setSubmitted(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewSource = (q) => {
    if (!q.sourceNoteId || !q.sourceBlockId) {
      alert('출처 정보를 찾을 수 없습니다.');
      return;
    }
    navigate(`/course/${courseId}/note/${q.sourceNoteId}`, { 
      state: { scrollToBlockId: q.sourceBlockId } 
    });
    onClose();
  };

  // 결과 리포트 화면 (제출 완료 또는 리포트 모드)
  if (submitted) {
    const score = mode === 'report' ? quizData.score : calculateScore();
    const total = questions.length;

    return (
      <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto pb-20" ref={scrollRef}>
        <IncorrectNoteModal 
          isOpen={isIncorrectModalOpen} 
          onClose={() => setIsIncorrectModalOpen(false)} 
          questionId={targetQuestionId} 
        />
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-8 text-center">
            <h2 className="text-xl font-black mb-2">{mode === 'report' ? '과거 학습 결과' : '학습 결과 리포트'}</h2>
            <p className="text-5xl font-black text-blue-600">{score} / {total} 점</p>
            {mode === 'report' && (
              <p className="text-xs text-slate-400 mt-2 font-bold">풀이 일시: {new Date(quizData.createdAt).toLocaleString()}</p>
            )}
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => {
              const userAnswer = mode === 'report' ? q.submittedAnswer : (answers[idx] || '');
              const isCorrect = mode === 'report' ? q.isCorrect : (String(userAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase());
              
              return (
                <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative group">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black text-slate-400">문제 {idx + 1}</p>
                    <div className="flex gap-2">
                      {q.sourceBlockId && (
                        <button 
                          onClick={() => handleViewSource(q)}
                          className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 bg-blue-50/50 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-full transition-all active:scale-95 shadow-sm"
                        >
                          <ExternalLink size={10} />
                          원문 보기
                        </button>
                      )}
                      {!isCorrect && (
                        <button 
                          onClick={() => {
                            setTargetQuestionId(q.questionId);
                            setIsIncorrectModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-[9px] font-black text-amber-600 bg-amber-50/50 hover:bg-amber-600 hover:text-white px-2.5 py-1 rounded-full transition-all active:scale-95 shadow-sm"
                        >
                          <Bookmark size={10} />
                          오답노트 담기
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-md font-bold mb-4">{q.questionText}</h3>
                  <div className="space-y-2 mb-4">
                    {q.type === 'SHORT_ANSWER' ? (
                      <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-500">내 답변:</span>
                          {isCorrect ? <CheckCircle size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}
                        </div>
                        <p className={`text-sm font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>{userAnswer || '(입력 없음)'}</p>
                        {!isCorrect && (
                          <div className="mt-3 pt-3 border-t border-red-100">
                            <span className="text-xs font-bold text-slate-500">정답:</span>
                            <p className="text-sm font-bold text-green-700">{q.correctAnswer}</p>
                          </div>
                        )}
                      </div>
                    ) : q.type === 'OX' ? (
                      <div className="flex gap-4">
                        {['O', 'X'].map((opt) => (
                          <div key={opt} className={`flex-1 p-3 rounded-xl border text-center font-black text-sm transition-all ${
                            opt === q.correctAnswer 
                              ? 'border-green-500 bg-green-50 text-green-700' 
                              : (userAnswer === opt ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 text-slate-300')
                          }`}>
                            {opt}
                            {opt === q.correctAnswer && <CheckCircle size={14} className="inline ml-2" />}
                            {userAnswer === opt && opt !== q.correctAnswer && <XCircle size={14} className="inline ml-2" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      q.options?.map((opt, i) => (
                        <div key={i} className={`p-3 rounded-lg border text-sm ${
                          opt === q.correctAnswer ? 'border-green-500 bg-green-50 text-green-700' : 
                          (userAnswer === opt ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100')
                        }`}>
                          {opt} {opt === q.correctAnswer && <CheckCircle size={14} className="inline ml-2" />}
                          {userAnswer === opt && opt !== q.correctAnswer && <XCircle size={14} className="inline ml-2" />}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 font-medium">
                    <span className="font-bold">해설: </span>{q.explanation}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={onClose} className="w-full mt-8 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg">학습 완료</button>
        </div>
      </div>
    );
  }

  // 문제 풀이 화면
  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col">
      <div className="bg-white border-b p-4 flex justify-between items-center shadow-sm">
        <h2 className="text-sm font-black text-slate-900">{quizData.title}</h2>
        <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-red-500 transition-colors">종료</button>
      </div>

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-2xl mx-auto w-full p-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">문제 {currentIdx + 1} / {questions.length}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{quizData.difficulty}</span>
            </div>
            
            <h3 className="text-xl font-bold mb-8 leading-snug text-slate-800">{currentQuestion?.questionText}</h3>
            
            <div className="space-y-3">
              {currentQuestion?.type === 'SHORT_ANSWER' ? (
                <input
                  type="text"
                  className="w-full p-4 rounded-xl border-2 border-slate-100 focus:border-blue-500 focus:bg-blue-50/30 outline-none text-sm font-bold transition-all"
                  placeholder="정답을 입력하세요..."
                  value={answers[currentIdx] || ''}
                  onChange={(e) => handleSelect(e.target.value)}
                />
              ) : currentQuestion?.type === 'OX' ? (
                <div className="flex gap-4">
                  {['O', 'X'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSelect(opt)}
                      className={`flex-1 p-6 rounded-2xl border-2 font-black text-lg transition-all ${
                        answers[currentIdx] === opt 
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md shadow-blue-100' 
                          : 'border-slate-50 bg-slate-50/50 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                currentQuestion?.options?.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left p-4 rounded-xl border-2 font-bold text-sm transition-all ${
                      answers[currentIdx] === opt 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md shadow-blue-100' 
                        : 'border-slate-50 bg-slate-50/50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    {opt}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-t p-4 flex justify-between items-center shadow-lg shadow-slate-200">
        <button 
          disabled={currentIdx === 0} 
          onClick={() => setCurrentIdx(currentIdx - 1)} 
          className="px-6 py-2.5 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-colors"
        >
          이전
        </button>
        
        {currentIdx === questions.length - 1 ? (
          <button 
            onClick={handleSubmit} 
            disabled={isSaving}
            className="px-10 py-2.5 text-xs font-black rounded-xl bg-blue-600 text-white flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200 disabled:bg-blue-300"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            제출하고 채점하기
          </button>
        ) : (
          <button 
            onClick={() => setCurrentIdx(currentIdx + 1)} 
            className="px-8 py-2.5 text-xs font-black rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200"
          >
            다음 문제
          </button>
        )}
      </div>
    </div>
  );
};

export default CBTPlayer;
