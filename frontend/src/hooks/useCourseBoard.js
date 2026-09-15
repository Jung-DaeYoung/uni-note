import { useEffect, useState } from 'react';
import axios from 'axios';
import client from '../api/client';

// 익명 게시판(글/댓글) 목록·상세·작성·수정·삭제 상태와 대시보드 postId 딥링크를 담당한다.
const useCourseBoard = ({ courseId, searchString }) => {
  const [posts, setPosts] = useState([]);

  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isBoardMaximized, setIsBoardMaximized] = useState(false);

  const [boardView, setBoardView] = useState('list');
  const [selectedPost, setSelectedPost] = useState(null);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [editingPost, setEditingPost] = useState({ title: '', content: '' });
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  // 빠른 강의 전환 시 이전 요청을 취소해, 늦게 도착한 응답이 현재 courseId의
  // 게시판 상태를 덮어쓰지 않도록 한다.
  useEffect(() => {
    const controller = new AbortController();
    const fetchPosts = async () => {
      try {
        const postsRes = await client.get(`/posts/${courseId}`, { signal: controller.signal });
        setPosts(postsRes.data || []);
      } catch (error) {
        if (axios.isCancel(error)) return;
        console.error("데이터 로딩 실패", error);
      }
    };
    fetchPosts();
    return () => controller.abort();
  }, [courseId]);

  // 대시보드에서 넘어온 postId 처리
  // URL(searchString)과 비동기로 불러온 posts 두 값이 모두 준비되어야 여는
  // 딥링크 동기화라서 단일 prop 기준의 "렌더링 중 파생 상태" 패턴으로 옮길 수 없다.
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const postIdFromUrl = params.get('postId');

    if (postIdFromUrl && posts.length > 0) {
      const targetPost = posts.find(p => p.postId === parseInt(postIdFromUrl));
      if (targetPost) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedPost(targetPost);
        setBoardView('detail');
        setIsBoardOpen(true);
      }
    }
  }, [searchString, posts]);

  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!newPost.title.trim() || !newPost.content.trim()) return;
    try {
      const res = await client.post(`/posts/${courseId}`, newPost);
      setPosts([res.data, ...posts]);
      setNewPost({ title: '', content: '' });
      setBoardView('list');
    } catch {
      alert("게시글 저장에 실패했습니다.");
    }
  };

  const handleUpdatePost = async (e) => {
    e.preventDefault();
    if (!editingPost.title.trim() || !editingPost.content.trim()) return;
    try {
      const res = await client.put(`/posts/${selectedPost.postId}`, editingPost);
      setPosts(posts.map(p => p.postId === selectedPost.postId ? res.data : p));
      setSelectedPost(res.data);
      setBoardView('detail');
    } catch {
      alert("게시글 수정에 실패했습니다.");
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedPost) return;
    try {
      await client.post(`/posts/${selectedPost.postId}/comments`, { content: newComment });
      const postsRes = await client.get(`/posts/${courseId}`);
      const updatedPosts = postsRes.data || [];
      setPosts(updatedPosts);
      const updatedPost = updatedPosts.find(p => p.postId === selectedPost.postId);
      if (updatedPost) setSelectedPost(updatedPost);
      setNewComment('');
    } catch {
      alert("댓글 작성에 실패했습니다.");
    }
  };

  const handleUpdateComment = async (commentId) => {
    if (!editingCommentContent.trim()) return;
    try {
      await client.put(`/posts/comments/${commentId}`, { content: editingCommentContent });
      const postsRes = await client.get(`/posts/${courseId}`);
      const updatedPosts = postsRes.data || [];
      setPosts(updatedPosts);
      const updatedPost = updatedPosts.find(p => p.postId === selectedPost.postId);
      if (updatedPost) setSelectedPost(updatedPost);
      setEditingCommentId(null);
    } catch {
      alert("댓글 수정에 실패했습니다.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await client.delete(`/posts/comments/${commentId}`);
      const postsRes = await client.get(`/posts/${courseId}`);
      const updatedPosts = postsRes.data || [];
      setPosts(updatedPosts);
      const updatedPost = updatedPosts.find(p => p.postId === selectedPost.postId);
      if (updatedPost) setSelectedPost(updatedPost);
    } catch {
      alert("댓글 삭제에 실패했습니다.");
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;
    if (!window.confirm("정말로 이 게시글을 삭제하시겠습니까?")) return;
    try {
      await client.delete(`/posts/${selectedPost.postId}`);
      setPosts(posts.filter(p => p.postId !== selectedPost.postId));
      setSelectedPost(null);
      setBoardView('list');
    } catch (error) {
      alert(error.response?.data?.message || "삭제 권한이 없거나 실패했습니다.");
    }
  };

  return {
    posts,
    isBoardOpen, setIsBoardOpen,
    isBoardMaximized, setIsBoardMaximized,
    boardView, setBoardView,
    selectedPost, setSelectedPost,
    newPost, setNewPost,
    editingPost, setEditingPost,
    newComment, setNewComment,
    editingCommentId, setEditingCommentId,
    editingCommentContent, setEditingCommentContent,
    handleSavePost,
    handleUpdatePost,
    handleSendComment,
    handleUpdateComment,
    handleDeleteComment,
    handleDeletePost,
  };
};

export default useCourseBoard;
