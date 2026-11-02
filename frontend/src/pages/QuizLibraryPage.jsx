import React, { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import CBTPlayer from '../components/editor/components/CBTPlayer';
import QuizAttemptsModal from '../components/editor/components/QuizAttemptsModal';
import QuizListPanel from '../components/quiz/QuizListPanel';
import QuizHistoryPanel from '../components/quiz/QuizHistoryPanel';
import useQuizLibrary from '../hooks/useQuizLibrary';
import './QuizLibraryPage.css';

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
    handleDeleteAttempt,
    handleShare,
    handleRename,
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

      <div className="lib-frame">
        <div className="lib">
          <h1 className="lib-title">학습 보관함</h1>

          <div className="lib-tabs">
            <button
              onClick={() => setActiveTab('quizzes')}
              aria-pressed={activeTab === 'quizzes'}
              className="lib-tab"
            >
              문제 모음
            </button>
            <button
              onClick={() => setActiveTab('history')}
              aria-pressed={activeTab === 'history'}
              className="lib-tab"
            >
              풀이 기록
            </button>
          </div>

          {activeTab === 'quizzes' ? (
            <QuizListPanel
              quizzes={quizzes}
              onRetake={handleRetake}
              onOpenAttempts={handleOpenAttempts}
              onDelete={handleDelete}
              onShare={handleShare}
              onRename={handleRename}
            />
          ) : (
            <QuizHistoryPanel
              attempts={attempts}
              isLoading={isLoading}
              onViewAttempt={handleViewAttempt}
              onDelete={handleDeleteAttempt}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default QuizLibraryPage;
