import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

// 오답노트 페이지(통계/모음)의 조회와 재풀이·삭제 액션을 담당한다.
// useQuizLibrary와 독립된 selectedQuiz를 소유하며, 두 훅은 서로 다른 페이지에서만 쓰인다.
const useIncorrectNotes = (view) => {
  const navigate = useNavigate();
  const [incorrectGroups, setIncorrectGroups] = useState([]);
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const [incorrectSummary, setIncorrectSummary] = useState(null);
  const [courseStats, setCourseStats] = useState([]);
  const [typeStats, setTypeStats] = useState([]);
  const [todayReview, setTodayReview] = useState([]);
  const [reviewCourseFilter, setReviewCourseFilter] = useState(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);

  const fetchIncorrectGroups = async () => {
    setIsGroupsLoading(true);
    try {
      const res = await client.get('/quiz/incorrect/groups');
      setIncorrectGroups(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGroupsLoading(false);
    }
  };

  const fetchTodayReview = async (courseId) => {
    try {
      const res = await client.get('/quiz/incorrect/review-today', {
        params: courseId ? { courseId } : {},
      });
      setTodayReview(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchIncorrectOverview = async () => {
    setIsOverviewLoading(true);
    try {
      const [summaryRes, courseRes, typeRes] = await Promise.all([
        client.get('/quiz/incorrect/summary'),
        client.get('/quiz/incorrect/statistics/courses'),
        client.get('/quiz/incorrect/statistics/types'),
      ]);
      setIncorrectSummary(summaryRes.data);
      setCourseStats(courseRes.data);
      setTypeStats(typeRes.data);
      await fetchTodayReview(reviewCourseFilter);
    } catch (err) {
      console.error(err);
    } finally {
      setIsOverviewLoading(false);
    }
  };

  // 화면(overview/groups) 진입 시 해당 화면에 필요한 데이터를 조회한다.
  // overview에서도 groups를 함께 조회하는 이유: IncorrectSummaryCards의 "저장된 오답" 카드가
  // incorrectGroups.itemCount 합으로 계산되는 클라이언트 파생값이라 summary 응답만으로는 부족하다.
  useEffect(() => {
    if (view === 'overview') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchIncorrectOverview();
      fetchIncorrectGroups();
    } else if (view === 'groups') {
      fetchIncorrectGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handlePracticeIncorrect = async (group) => {
    if (group.itemCount === 0) {
      alert('복습할 문제가 없습니다.');
      return;
    }
    try {
      const res = await client.get(`/quiz/incorrect/groups/${group.id}/practice`);
      setSelectedQuiz(res.data);
    } catch {
      alert('오답노트 정보를 불러오는 데 실패했습니다.');
    }
  };

  const handleReviewCourseFilterChange = (courseId) => {
    setReviewCourseFilter(courseId);
    fetchTodayReview(courseId);
  };

  const handleViewReviewSource = (item) => {
    const q = item.question;
    if (!q.sourceNoteId || !q.sourceBlockId) {
      alert('출처 정보를 찾을 수 없습니다.');
      return;
    }
    navigate(`/course/${item.courseId}/note/${q.sourceNoteId}`, {
      state: { scrollToBlockId: q.sourceBlockId },
    });
  };

  // QuizConfigModal/IncorrectNoteService.getPracticeSession과 동일한 관례(quizSetId: -1)로
  // CBTPlayer가 그대로 재사용할 수 있는 가상 세션을 클라이언트에서 직접 구성한다.
  const handlePracticeReviewQuestion = (item) => {
    setSelectedQuiz({
      quizSetId: -1,
      title: '오늘의 복습',
      difficulty: 'NORMAL',
      questions: [item.question],
      courseId: item.courseId,
    });
  };

  const handleDeleteGroup = async (e, groupId) => {
    e.stopPropagation();
    if (!window.confirm('오답노트를 삭제하시겠습니까? (저장된 오답들도 함께 사라집니다)')) return;
    try {
      await client.delete(`/quiz/incorrect/groups/${groupId}`);
      setIncorrectGroups(incorrectGroups.filter(g => g.id !== groupId));
    } catch {
      alert('삭제 실패');
    }
  };

  return {
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
  };
};

export default useIncorrectNotes;
