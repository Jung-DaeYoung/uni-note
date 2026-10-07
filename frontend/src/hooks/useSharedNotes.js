import { useEffect, useState } from 'react';
import client from '../api/client';

// 노트 공유 게시판의 강의 필터 조회와 글 삭제를 담당한다. 상세·댓글은 SharedNoteViewer가 직접 불러온다.
const useSharedNotes = () => {
  const [courseId, setCourseId] = useState('');
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const res = await client.get('/shared-notes', { params: courseId ? { courseId } : {} });
      setPosts(res.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || '공유 노트 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 강의 필터가 바뀌면 다시 조회한다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // 삭제하면 다른 수강생도 즉시 볼 수 없다. 성공 여부를 반환해 상세 화면이 목록으로 돌아갈 수 있게 한다.
  const deletePost = async (post) => {
    if (!window.confirm('게시판에서 이 노트 공유를 내릴까요?\n댓글도 함께 삭제됩니다.')) return false;
    try {
      await client.delete(`/shared-notes/${post.sharedNotePostId}`);
      setPosts(prev => prev.filter(p => p.sharedNotePostId !== post.sharedNotePostId));
      return true;
    } catch (err) {
      alert(err.response?.data?.message || '삭제하지 못했습니다.');
      return false;
    }
  };

  return { courseId, setCourseId, posts, isLoading, deletePost };
};

export default useSharedNotes;
