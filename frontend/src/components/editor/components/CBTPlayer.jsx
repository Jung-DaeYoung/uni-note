import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle, XCircle, BookOpen, RotateCcw } from 'lucide-react';

const CBTPlayer = ({ quizData, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const scrollRef = useRef(null);

  const currentQuestion = quizData.questions[currentIdx];

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
    quizData.questions.forEach((q, idx) => {
      const isCorrect = String(answers[idx] || '').trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
      if (isCorrect) score++;
    });
    return score;
  };

  if (submitted) {
    const score = calculateScore();
    return (
      <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto pb-20" ref={scrollRef}>
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-8 text-center">
            <h2 className="text-xl font-black mb-2">학습 결과 리포트</h2>
            <p className="text-5xl font-black text-blue-600">{score} / {quizData.questions.length} 점</p>
          </div>

          <div className="space-y-6">
            {quizData.questions.map((q, idx) => {
              const isCorrect = String(answers[idx] || '').trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
              return (
                <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 mb-2">문제 {idx + 1}</p>
                  <h3 className="text-md font-bold mb-4">{q.questionText}</h3>
                  <div className="space-y-2 mb-4">
                    {q.type === 'SHORT_ANSWER' ? (
                      <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-500">내 답변:</span>
                          {isCorrect ? <CheckCircle size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}
                        </div>
                        <p className={`text-sm font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>{answers[idx] || '(입력 없음)'}</p>
                        {!isCorrect && (
                          <div className="mt-3 pt-3 border-t border-red-100">
                            <span className="text-xs font-bold text-slate-500">정답:</span>
                            <p className="text-sm font-bold text-green-700">{q.correctAnswer}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      q.options?.map((opt, i) => (
                        <div key={i} className={`p-3 rounded-lg border text-sm ${
                          opt === q.correctAnswer ? 'border-green-500 bg-green-50 text-green-700' : 
                          (answers[idx] === opt ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100')
                        }`}>
                          {opt} {opt === q.correctAnswer && <CheckCircle size={14} className="inline ml-2" />}
                          {answers[idx] === opt && opt !== q.correctAnswer && <XCircle size={14} className="inline ml-2" />}
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
          <button onClick={onClose} className="w-full mt-8 py-3 bg-slate-900 text-white font-bold rounded-xl">학습 완료</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col">
      <div className="bg-white border-b p-4 flex justify-between items-center">
        <h2 className="text-sm font-black text-slate-900">{quizData.title}</h2>
        <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-red-500">종료</button>
      </div>

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-2xl mx-auto w-full p-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded">문제 {currentIdx + 1}</span>
              <span className="text-[10px] font-bold text-slate-400">{quizData.difficulty}</span>
            </div>
            
            <h3 className="text-xl font-bold mb-8 leading-snug">{currentQuestion.questionText}</h3>
            
            <div className="space-y-3">
              {currentQuestion.type === 'SHORT_ANSWER' ? (
                <input
                  type="text"
                  className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-sm"
                  placeholder="정답을 입력하세요..."
                  value={answers[currentIdx] || ''}
                  onChange={(e) => handleSelect(e.target.value)}
                  disabled={submitted}
                />
              ) : currentQuestion.type === 'OX' ? (
                <div className="flex gap-4">
                  {['O', 'X'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSelect(opt)}
                      className={`flex-1 p-4 rounded-xl border-2 font-bold transition-all ${
                        answers[currentIdx] === opt 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-slate-100 hover:border-slate-200'
                      } ${submitted && opt === currentQuestion.correctAnswer ? 'border-green-500 bg-green-50 text-green-700' : ''}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                currentQuestion.options?.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      answers[currentIdx] === opt 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-slate-100 hover:border-slate-200'
                    } ${submitted && opt === currentQuestion.correctAnswer ? 'border-green-500 bg-green-50 text-green-700' : ''}`}
                  >
                    {opt}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-t p-4 flex justify-between items-center">
        <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(currentIdx - 1)} className="px-6 py-2 text-xs font-bold rounded-xl bg-slate-100 disabled:opacity-30">이전</button>
        {currentIdx === quizData.questions.length - 1 ? (
          <button onClick={() => setSubmitted(true)} className="px-8 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white">제출하기</button>
        ) : (
          <button onClick={() => setCurrentIdx(currentIdx + 1)} className="px-6 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white">다음</button>
        )}
      </div>
    </div>
  );
};

export default CBTPlayer;
