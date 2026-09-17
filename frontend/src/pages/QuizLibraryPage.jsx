import React, { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { BookOpen, History, Bookmark } from 'lucide-react';
import CBTPlayer from '../components/editor/components/CBTPlayer';
import QuizAttemptsModal from '../components/editor/components/QuizAttemptsModal';
import QuizListPanel from '../components/quiz/QuizListPanel';
import QuizHistoryPanel from '../components/quiz/QuizHistoryPanel';
import IncorrectGroupsPanel from '../components/quiz/IncorrectGroupsPanel';
import IncorrectSummaryCards from '../components/quiz/IncorrectSummaryCards';
import TodayReviewList from '../components/quiz/TodayReviewList';
import WeakAreaBreakdown from '../components/quiz/WeakAreaBreakdown';
import useQuizLibrary from '../hooks/useQuizLibrary';

const QuizLibraryPage = () => {
  const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes' | 'history' | 'incorrect'

  const {
    quizzes,
    attempts,
    incorrectGroups,
    selectedQuiz, setSelectedQuiz,
    selectedAttempt, setSelectedAttempt,
    isLoading,
    isAttemptsModalOpen, setIsAttemptsModalOpen,
    targetQuiz,
    handleRetake,
    handlePracticeIncorrect,
    handleDeleteGroup,
    handleViewAttempt,
    handleOpenAttempts,
    handleDelete,
    incorrectSummary,
    courseStats,
    typeStats,
    todayReview,
    reviewCourseFilter,
    isOverviewLoading,
    handleReviewCourseFilterChange,
    handleViewReviewSource,
    handlePracticeReviewQuestion,
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
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">학습 보관함</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">생성된 퀴즈와 과거 풀이 기록을 관리하세요.</p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
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
            <button
              onClick={() => setActiveTab('incorrect')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'incorrect' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <Bookmark size={14} />
              오답노트
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
        ) : activeTab === 'history' ? (
          <QuizHistoryPanel
            attempts={attempts}
            isLoading={isLoading}
            onViewAttempt={handleViewAttempt}
          />
        ) : (
          <div className="space-y-8">
            <IncorrectSummaryCards
              summary={incorrectSummary}
              todayReviewCount={todayReview.length}
              savedCount={incorrectGroups.reduce((sum, g) => sum + g.itemCount, 0)}
              isLoading={isOverviewLoading}
            />
            <TodayReviewList
              items={todayReview}
              isLoading={isOverviewLoading}
              courseOptions={courseStats}
              courseFilter={reviewCourseFilter}
              onCourseFilterChange={handleReviewCourseFilterChange}
              onViewSource={handleViewReviewSource}
              onPracticeOne={handlePracticeReviewQuestion}
            />
            <WeakAreaBreakdown
              courseStats={courseStats}
              typeStats={typeStats}
              isLoading={isOverviewLoading}
            />
            <IncorrectGroupsPanel
              incorrectGroups={incorrectGroups}
              isLoading={isLoading}
              onPracticeIncorrect={handlePracticeIncorrect}
              onDeleteGroup={handleDeleteGroup}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default QuizLibraryPage;
