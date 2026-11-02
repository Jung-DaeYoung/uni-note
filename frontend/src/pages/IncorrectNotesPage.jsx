import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import CBTPlayer from '../components/editor/components/CBTPlayer';
import IncorrectGroupsPanel from '../components/quiz/IncorrectGroupsPanel';
import IncorrectSummaryCards from '../components/quiz/IncorrectSummaryCards';
import TodayReviewList from '../components/quiz/TodayReviewList';
import WeakAreaBreakdown from '../components/quiz/WeakAreaBreakdown';
import useIncorrectNotes from '../hooks/useIncorrectNotes';
import './QuizLibraryPage.css';
import './IncorrectNotesPage.css';

const IncorrectNotesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const view = location.pathname === '/incorrect-notes/groups' ? 'groups' : 'overview';

  const {
    incorrectGroups,
    isGroupsLoading,
    selectedQuiz,
    incorrectSummary,
    courseStats,
    typeStats,
    conceptStats,
    todayReview,
    reviewCourseFilter,
    isOverviewLoading,
    handlePracticeIncorrect,
    handleReviewCourseFilterChange,
    handleViewReviewSource,
    handlePracticeReviewQuestion,
    handleDeleteGroup,
    handleRenameGroup,
    closePractice,
  } = useIncorrectNotes(view);

  return (
    <AppLayout>
      {selectedQuiz && (
        <CBTPlayer
          quizData={selectedQuiz}
          onClose={closePractice}
          mode="solve"
          courseId={selectedQuiz.courseId}
        />
      )}

      <div className="lib-frame">
        <div className="lib">
          <h1 className="lib-title">오답노트</h1>

          <div className="lib-tabs">
            <button
              onClick={() => navigate('/incorrect-notes')}
              aria-pressed={view === 'overview'}
              className="lib-tab"
            >
              오답 통계
            </button>
            <button
              onClick={() => navigate('/incorrect-notes/groups')}
              aria-pressed={view === 'groups'}
              className="lib-tab"
            >
              오답노트 모음
            </button>
          </div>

          {view === 'overview' ? (
            <>
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
                conceptStats={conceptStats}
                isLoading={isOverviewLoading}
              />
            </>
          ) : (
            <IncorrectGroupsPanel
              incorrectGroups={incorrectGroups}
              isLoading={isGroupsLoading}
              onPracticeIncorrect={handlePracticeIncorrect}
              onDeleteGroup={handleDeleteGroup}
              onRenameGroup={handleRenameGroup}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default IncorrectNotesPage;
