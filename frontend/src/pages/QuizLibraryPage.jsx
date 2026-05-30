import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import client from '../api/client';
import { BookOpen, BrainCircuit, Trash2, History, CheckCircle2, ChevronRight, Calendar, Search } from 'lucide-react';
import CBTPlayer from '../components/editor/components/CBTPlayer';
import QuizAttemptsModal from '../components/editor/components/QuizAttemptsModal';

const QuizLibraryPage = () => {
  const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes' | 'history'
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 신규: 퀴즈별 기록 모달 관련 상태
  const [isAttemptsModalOpen, setIsAttemptsModalOpen] = useState(false);
  const [targetQuiz, setTargetQuiz] = useState(null);

  const fetchQuizzes = async () => {
    try {
      const res = await client.get('/quiz/my');
      setQuizzes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await client.get('/quiz/attempts/my');
      setAttempts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'quizzes') fetchQuizzes();
    else fetchHistory();
  }, [activeTab]);

  const handleRetake = async (quiz) => {
    try {
      const res = await client.get(`/quiz/${quiz.quizSetId}`);
      setSelectedQuiz({ ...res.data, quizSetId: quiz.quizSetId, courseId: quiz.courseId });
    } catch (err) {
      alert('퀴즈 정보를 불러오는 데 실패했습니다.');
    }
  };

  const handleViewAttempt = async (attemptId) => {
    try {
      const res = await client.get(`/quiz/attempts/${attemptId}`);
      setSelectedAttempt(res.data); 
      setIsAttemptsModalOpen(false); // 모달 닫기
    } catch (err) {
      console.error("기록 상세 조회 실패:", err);
      alert(`기록 정보를 불러오는 데 실패했습니다. (ID: ${attemptId})`);
    }
  };

  const handleOpenAttempts = (quiz) => {
    setTargetQuiz(quiz);
    setIsAttemptsModalOpen(true);
  };

  const handleDelete = async (e, quizSetId) => {
    e.stopPropagation();
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await client.delete(`/quiz/${quizSetId}`);
      setQuizzes(quizzes.filter(q => q.quizSetId !== quizSetId));
    } catch (err) {
      alert('삭제 실패');
    }
  };

  return (
    <AppLayout>
      {selectedQuiz && (
        <CBTPlayer 
          quizData={selectedQuiz} 
          onClose={() => setSelectedQuiz(null)} 
          mode="solve"
          courseId={selectedQuiz.courseId}
        />
      )}

      {selectedAttempt && (
        <CBTPlayer 
          quizData={selectedAttempt} 
          onClose={() => setSelectedAttempt(null)} 
          mode="report"
          courseId={selectedAttempt.courseId}
        />
      )}

      <QuizAttemptsModal 
        isOpen={isAttemptsModalOpen}
        onClose={() => setIsAttemptsModalOpen(false)}
        quizSetId={targetQuiz?.quizSetId}
        quizTitle={targetQuiz?.title}
        onViewAttempt={handleViewAttempt}
      />

      <div className="p-8 max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">학습 보관함</h1>
            <p className="text-sm text-slate-500 font-medium">생성된 퀴즈와 과거 풀이 기록을 관리하세요.</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button 
              onClick={() => setActiveTab('quizzes')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'quizzes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BookOpen size={14} />
              문제 모음
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <History size={14} />
              풀이 기록
            </button>
          </div>
        </header>
        
        {activeTab === 'quizzes' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.length === 0 ? (
              <div className="col-span-2 text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <BrainCircuit size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="font-bold text-slate-400 text-sm">아직 생성된 퀴즈가 없습니다.</p>
              </div>
            ) : (
              quizzes.map(quiz => (
                <div key={quiz.quizSetId} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black px-2 py-1 bg-blue-600 text-white rounded-lg uppercase tracking-tight shadow-sm shadow-blue-200">
                      {quiz.courseName}
                    </span>
                  </div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{quiz.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">{quiz.difficulty}</span>
                      <button onClick={(e) => handleDelete(e, quiz.quizSetId)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-6 font-bold flex items-center gap-1">
                    <Calendar size={12} />
                    생성일: {new Date(quiz.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleRetake(quiz)}
                      className="flex-1 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98] shadow-sm"
                    >
                      다시 풀기
                    </button>
                    <button 
                      onClick={() => handleOpenAttempts(quiz)}
                      className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      <Search size={14} />
                      결과 확인
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-20">
                <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-sm font-bold text-slate-400">기록을 불러오는 중...</p>
              </div>
            ) : attempts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <History size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="font-bold text-slate-400 text-sm">아직 풀이 기록이 없습니다.</p>
              </div>
            ) : (
              attempts.map(attempt => (
                <div 
                  key={attempt.attemptId} 
                  onClick={() => handleViewAttempt(attempt.attemptId)}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm ${attempt.score === attempt.totalQuestions ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                      {Math.round((attempt.score / attempt.totalQuestions) * 100)}%
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{attempt.quizTitle}</h3>
                      <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        {attempt.score} / {attempt.totalQuestions} 문제 맞춤 • {new Date(attempt.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default QuizLibraryPage;
