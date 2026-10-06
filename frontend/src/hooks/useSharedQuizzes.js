import { useEffect, useState } from 'react';
import client from '../api/client';

// CBT 시험 공유게시판의 정렬·강의 필터 조회와 추천·풀기·글 삭제 액션을 담당한다.
const useSharedQuizzes = () => {
  const [sort, setSort] = useState('latest'); // 'latest' | 'likes' | 'views'
  const [courseId, setCourseId] = useState('');
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const res = await client.get('/shared-quizzes', {
        params: courseId ? { sort, courseId } : { sort },
      });
      setPosts(res.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || '공유 시험 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 정렬/강의 필터가 바뀌면 다시 조회한다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, courseId]);

  const toggleLike = async (post) => {
    try {
      const res = await client.post(`/shared-quizzes/${post.sharedQuizId}/like`);
      setPosts(prev => prev.map(p => (
        p.sharedQuizId === post.sharedQuizId ? { ...p, liked: res.data.liked, likeCount: res.data.likeCount } : p
      )));
    } catch (err) {
      alert(err.response?.data?.message || '추천하지 못했습니다.');
    }
  };

  // 상세를 열면 서버에서 조회수가 1 오른다. 풀이는 공유 스냅샷의 quizSetId로 저장된다.
  const openQuiz = async (post) => {
    try {
      const res = await client.get(`/shared-quizzes/${post.sharedQuizId}`);
      setSelectedQuiz({ ...res.data, courseId: post.courseId, sharedQuizId: post.sharedQuizId });
      setPosts(prev => prev.map(p => (
        p.sharedQuizId === post.sharedQuizId ? { ...p, viewCount: p.viewCount + 1 } : p
      )));
    } catch (err) {
      alert(err.response?.data?.message || '시험을 불러오지 못했습니다.');
    }
  };

  const deletePost = async (post) => {
    if (!window.confirm('게시판에서 이 시험을 내릴까요?\n이미 풀었거나 오답노트에 담은 사용자의 기록은 유지됩니다.')) return;
    try {
      await client.delete(`/shared-quizzes/${post.sharedQuizId}`);
      setPosts(prev => prev.filter(p => p.sharedQuizId !== post.sharedQuizId));
    } catch (err) {
      alert(err.response?.data?.message || '삭제하지 못했습니다.');
    }
  };

  return {
    sort, setSort,
    courseId, setCourseId,
    posts,
    isLoading,
    selectedQuiz, setSelectedQuiz,
    toggleLike,
    openQuiz,
    deletePost,
  };
};

export default useSharedQuizzes;
