import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { BarChart3, FolderOpen } from 'lucide-react';
import CBTPlayer from '../components/editor/components/CBTPlayer';
import IncorrectGroupsPanel from '../components/quiz/IncorrectGroupsPanel';
import IncorrectSummaryCards from '../components/quiz/IncorrectSummaryCards';
import TodayReviewList from '../components/quiz/TodayReviewList';
import WeakAreaBreakdown from '../components/quiz/WeakAreaBreakdown';
import useIncorrectNotes from '../hooks/useIncorrectNotes';

const IncorrectNotesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const view = location.pathname === '/incorrect-notes/groups' ? 'groups' : 'overview';

  const {
    incorrectGroups,
    isGroupsLoading,
    selectedQuiz, setSelectedQuiz,
    incorrectSummary,
    courseStats,
    typeStats,
    todayReview,
    reviewCourseFilter,
    isOverviewLoading,
    handlePracticeIncorrect,
    handleReviewCourseFilterChange,
    handleViewReviewSource,
    handlePracticeReviewQuestion,
    handleDeleteGroup,
  } = useIncorrectNotes(view);

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

      <div className="p-8 max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">오답노트</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">틀린 문제를 분석하고 복습하세요.</p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => navigate('/incorrect-notes')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${view === 'overview' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <BarChart3 size={14} />
              오답 통계
            </button>
            <button
              onClick={() => navigate('/incorrect-notes/groups')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${view === 'groups' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <FolderOpen size={14} />
              오답노트 모음
            </button>
          </div>
        </header>

        {view === 'overview' ? (
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
          </div>
        ) : (
          <IncorrectGroupsPanel
            incorrectGroups={incorrectGroups}
            isLoading={isGroupsLoading}
            onPracticeIncorrect={handlePracticeIncorrect}
            onDeleteGroup={handleDeleteGroup}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default IncorrectNotesPage;
