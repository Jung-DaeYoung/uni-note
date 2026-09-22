import React, { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { BookOpen, History } from 'lucide-react';
import CBTPlayer from '../components/editor/components/CBTPlayer';
import QuizAttemptsModal from '../components/editor/components/QuizAttemptsModal';
import QuizListPanel from '../components/quiz/QuizListPanel';
import QuizHistoryPanel from '../components/quiz/QuizHistoryPanel';
import useQuizLibrary from '../hooks/useQuizLibrary';

const QuizLibraryPage = () => {
  const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes' | 'history'

  const {
    quizzes,
    attempts,
    selectedQuiz, setSelectedQuiz,
    selectedAttempt, setSelectedAttempt,
    isLoading,
    isAttemptsModalOpen, setIsAttemptsModalOpen,
    targetQuiz,
    handleRetake,
    handleViewAttempt,
    handleOpenAttempts,
    handleDelete,
  } = useQuizLibrary(activeTab);

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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">학습 보관함</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">생성된 퀴즈와 과거 풀이 기록을 관리하세요.</p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'quizzes' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <BookOpen size={14} />
              문제 모음
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <History size={14} />
              풀이 기록
            </button>
          </div>
        </header>

        {activeTab === 'quizzes' ? (
          <QuizListPanel
            quizzes={quizzes}
            onRetake={handleRetake}
            onOpenAttempts={handleOpenAttempts}
            onDelete={handleDelete}
          />
        ) : (
          <QuizHistoryPanel
            attempts={attempts}
            isLoading={isLoading}
            onViewAttempt={handleViewAttempt}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default QuizLibraryPage;
