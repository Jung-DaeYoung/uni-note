import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

// 학습 보관함의 탭별 조회(퀴즈/풀이 이력/오답노트)와 재풀이·이력·삭제 액션을 담당한다.
const useQuizLibrary = (activeTab) => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [incorrectGroups, setIncorrectGroups] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isAttemptsModalOpen, setIsAttemptsModalOpen] = useState(false);
  const [targetQuiz, setTargetQuiz] = useState(null);

  // 오답노트 탭 상단의 통계 카드/오늘의 복습/취약 영역
  const [incorrectSummary, setIncorrectSummary] = useState(null);
  const [courseStats, setCourseStats] = useState([]);
  const [typeStats, setTypeStats] = useState([]);
  const [todayReview, setTodayReview] = useState([]);
  const [reviewCourseFilter, setReviewCourseFilter] = useState(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);

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

  const fetchIncorrectGroups = async () => {
    setIsLoading(true);
    try {
      const res = await client.get('/quiz/incorrect/groups');
      setIncorrectGroups(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
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

  // 탭 전환 시 해당 탭 데이터를 조회한다. fetch* 함수 내부에서 로딩/결과 상태를 갱신하므로
  // 렌더링 중 파생 상태로 옮길 수 없는 통상적인 "탭 변경 → 데이터 조회" 동기화다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === 'quizzes') fetchQuizzes();
    else if (activeTab === 'history') fetchHistory();
    else if (activeTab === 'incorrect') {
      fetchIncorrectGroups();
      fetchIncorrectOverview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleRetake = async (quiz) => {
    try {
      const res = await client.get(`/quiz/${quiz.quizSetId}`);
      setSelectedQuiz({ ...res.data, quizSetId: quiz.quizSetId, courseId: quiz.courseId });
    } catch {
      alert('퀴즈 정보를 불러오는 데 실패했습니다.');
    }
  };

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
    } catch {
      alert('삭제 실패');
    }
  };

  return {
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
  };
};

export default useQuizLibrary;
