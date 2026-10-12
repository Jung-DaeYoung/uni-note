import { useEffect, useState } from 'react';
import client from '../api/client';
import { useConfirm } from '../context/ConfirmContext';

// 학습 보관함의 탭별 조회(퀴즈/풀이 이력)와 재풀이·이력·삭제 액션을 담당한다.
const useQuizLibrary = (activeTab) => {
  const confirm = useConfirm();
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

  // 탭 전환 시 해당 탭 데이터를 조회한다. fetch* 함수 내부에서 로딩/결과 상태를 갱신하므로
  // 렌더링 중 파생 상태로 옮길 수 없는 통상적인 "탭 변경 → 데이터 조회" 동기화다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === 'quizzes') fetchQuizzes();
    else if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  const handleRetake = async (quiz) => {
    try {
      const res = await client.get(`/quiz/${quiz.quizSetId}`);
      setSelectedQuiz({ ...res.data, quizSetId: quiz.quizSetId, courseId: quiz.courseId });
    } catch {
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

  // 공유하면 서버가 스냅샷을 복사해 게시판에 올린다. 원본을 지워도 게시판 글은 남는다.
  const handleShare = async (e, quiz) => {
    e.stopPropagation();
    if (!(await confirm({
      title: `'${quiz.title}'을(를) CBT 시험 공유게시판에 공유할까요?`,
      message: '같은 강의 수강생이 풀 수 있고, 원문 보기는 제공되지 않습니다.',
      variant: 'share',
      confirmLabel: '공유하기',
    }))) return;
    try {
      await client.post('/shared-quizzes', { quizSetId: quiz.quizSetId });
      setQuizzes(prev => prev.map(q => (q.quizSetId === quiz.quizSetId ? { ...q, shared: true } : q)));
    } catch (err) {
      alert(err.response?.data?.message || '공유하지 못했습니다.');
    }
  };

  const handleDelete = async (e, quizSetId) => {
    e.stopPropagation();
    const shared = quizzes.find(q => q.quizSetId === quizSetId)?.shared;
    if (!(await confirm({
      title: '퀴즈를 삭제할까요?',
      message: shared
        ? '삭제한 퀴즈는 복구할 수 없습니다.\n공유게시판에 올린 글은 유지됩니다. 글을 내리려면 게시판에서 삭제하세요.'
        : '삭제한 퀴즈는 복구할 수 없습니다.',
      confirmLabel: '퀴즈 삭제',
    }))) return;
    try {
      await client.delete(`/quiz/${quizSetId}`);
      setQuizzes(quizzes.filter(q => q.quizSetId !== quizSetId));
    } catch {
      alert('삭제 실패');
    }
  };

  const handleDeleteAttempt = async (e, attemptId) => {
    e.stopPropagation();
    if (!(await confirm({
      title: '이 풀이 기록을 삭제할까요?',
      message: '오답 통계에서도 빠집니다.',
      confirmLabel: '기록 삭제',
    }))) return;
    try {
      await client.delete(`/quiz/attempts/${attemptId}`);
      setAttempts(prev => prev.filter(a => a.attemptId !== attemptId));
    } catch (err) {
      alert(err.response?.data?.message || '풀이 기록을 삭제하지 못했습니다.');
    }
  };

  return {
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
  };
};

export default useQuizLibrary;
