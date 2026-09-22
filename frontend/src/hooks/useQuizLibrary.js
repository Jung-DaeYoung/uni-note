import { useEffect, useState } from 'react';
import client from '../api/client';

// 학습 보관함의 탭별 조회(퀴즈/풀이 이력)와 재풀이·이력·삭제 액션을 담당한다.
const useQuizLibrary = (activeTab) => {
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
    selectedQuiz, setSelectedQuiz,
    selectedAttempt, setSelectedAttempt,
    isLoading,
    isAttemptsModalOpen, setIsAttemptsModalOpen,
    targetQuiz,
    handleRetake,
    handleViewAttempt,
    handleOpenAttempts,
    handleDelete,
  };
};

export default useQuizLibrary;
