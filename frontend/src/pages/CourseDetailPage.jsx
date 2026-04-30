import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Plus, ChevronLeft, User, Search, Trash2, Maximize2, Minimize2, PenLine, Send } from 'lucide-react';
import client from '../api/client';
import AppLayout from '../components/layout/AppLayout';
import NotionEditor from '../components/editor/NotionEditor';

const CourseDetailPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // States
  const [courseName, setCourseName] = useState('');
  const [posts, setPosts] = useState([]);
  
  // Board Sidebar State
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isBoardMaximized, setIsBoardMaximized] = useState(false);
  
  // Board Logic States
  const [boardView, setBoardView] = useState('list'); 
  const [selectedPost, setSelectedPost] = useState(null);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [editingPost, setEditingPost] = useState({ title: '', content: '' });
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboardRes = await client.get('/dashboard/courses');
        const currentCourse = dashboardRes.data.courses.find(c => c.courseId === parseInt(courseId));
        if (currentCourse) setCourseName(currentCourse.courseName);

        const postsRes = await client.get(`/posts/${courseId}`);
        const fetchedPosts = postsRes.data || [];
        setPosts(fetchedPosts);

        // URL postId Logic
        const params = new URLSearchParams(location.search);
        const postIdFromUrl = params.get('postId');
        if (postIdFromUrl && fetchedPosts.length > 0) {
          const targetPost = fetchedPosts.find(p => p.postId === parseInt(postIdFromUrl));
          if (targetPost) {
            setSelectedPost(targetPost);
            setBoardView('detail');
            setIsBoardOpen(true);
          }
        }
      } catch (error) {
        console.error("데이터 로딩 실패", error);
      }
    };
    fetchData();
  }, [courseId, location.search]);

  // Handlers
  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!newPost.title.trim() || !newPost.content.trim()) return;
    try {
      const res = await client.post(`/posts/${courseId}`, newPost);
      setPosts([res.data, ...posts]);
      setNewPost({ title: '', content: '' });
      setBoardView('list');
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-64px)] bg-slate-50 overflow-hidden relative font-sans">
        {/* Left: Lecture Note Area */}
        <main className={`flex-1 overflow-y-auto p-6 transition-all duration-500 ease-in-out bg-white ${isBoardOpen ? (isBoardMaximized ? 'opacity-0 invisible' : 'mr-[400px]') : 'mr-0'}`}>
          <div className={`mx-auto transition-all duration-500 px-4 ${isBoardOpen ? 'max-w-4xl' : 'max-w-7xl'}`}>
            <header className="mb-12 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{courseName}</h1>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-[0.3em]">Workspace</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsBoardOpen(!isBoardOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg ${
                    isBoardOpen 
                    ? 'bg-slate-900 text-white ring-4 ring-slate-100' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                  }`}
                >
                  <MessageSquare size={14} />
                  {isBoardOpen ? '닫기' : '익명 커뮤니티'}
                </button>
              </div>
            </header>

            <div className="space-y-6">
              <NotionEditor courseId={courseId} />
            </div>
          </div>
        </main>

        {/* Right Sidebar (Community) */}
        <aside className={`fixed right-0 top-[64px] h-[calc(100vh-64px)] bg-white border-l border-slate-200 shadow-[-10px_0_30px_rgba(0,0,0,0.03)] transition-all duration-500 ease-in-out z-20 flex flex-col ${isBoardOpen ? (isBoardMaximized ? 'w-full translate-x-0' : 'w-[400px] translate-x-0') : 'w-0 translate-x-full'}`}>
          <div className={`${isBoardOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 flex flex-col h-full`}>
            {/* Board Header */}
            <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">익명 커뮤니티</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Community</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {boardView === 'list' && (
                  <button 
                    onClick={() => setBoardView('write')}
                    className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-lg transition-all border border-slate-100"
                  >
                    <Plus size={16} />
                  </button>
                )}
                <button 
                  onClick={() => setIsBoardMaximized(!isBoardMaximized)}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg transition-all"
                >
                  {isBoardMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30 ${isBoardMaximized ? 'max-w-5xl mx-auto w-full px-10' : ''}`}>
              {/* Board Views (List, Write, Edit, Detail) - existing logic kept */}
              {boardView === 'list' && (
                <div className="grid gap-4">
                  {posts.length === 0 ? (
                    <div className="text-center py-20 opacity-20">
                      <Search size={40} className="mx-auto mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest">게시글이 없습니다</p>
                    </div>
                  ) : (
                    posts.map(post => (
                      <button 
                        key={post.postId} 
                        onClick={() => {
                          setSelectedPost(post);
                          setBoardView('detail');
                        }}
                        className="bg-white p-5 rounded-[1.2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all text-left"
                      >
                        <div className="flex items-center justify-between mb-2.5 text-[9px] font-black uppercase tracking-widest">
                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{post.authorName}</span>
                          <span className="text-slate-300">{new Date(post.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mb-1.5 leading-snug">{post.title}</h4>
                        <p className="text-slate-500 text-xs line-clamp-2 mb-3 leading-relaxed">{post.content}</p>
                        <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[9px] uppercase tracking-tighter">
                          <MessageSquare size={10} /> {post.comments?.length || 0} 댓글
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {boardView === 'write' && (
                <div className="bg-white p-6 rounded-[1.5rem] border border-blue-50 shadow-xl">
                  <div className="flex items-center gap-1.5 mb-6 text-blue-600 cursor-pointer text-xs font-bold uppercase" onClick={() => setBoardView('list')}>
                    <ChevronLeft size={16} /> 목록으로
                  </div>
                  <form onSubmit={handleSavePost} className="space-y-4">
                    <input 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold outline-none"
                      placeholder="제목을 입력하세요"
                      value={newPost.title}
                      onChange={e => setNewPost({...newPost, title: e.target.value})}
                      required
                    />
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs outline-none h-80"
                      placeholder="내용을 입력하세요..."
                      value={newPost.content}
                      onChange={e => setNewPost({...newPost, content: e.target.value})}
                      required
                    />
                    <button type="submit" className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-xs shadow-lg">등록하기</button>
                  </form>
                </div>
              )}

              {boardView === 'edit' && (
                <div className="bg-white p-6 rounded-[1.5rem] border border-blue-50 shadow-xl">
                  <div className="flex items-center gap-1.5 mb-6 text-blue-600 cursor-pointer text-xs font-bold uppercase" onClick={() => setBoardView('detail')}>
                    <ChevronLeft size={16} /> 수정 취소
                  </div>
                  <form onSubmit={handleUpdatePost} className="space-y-4">
                    <input
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold outline-none"
                      value={editingPost.title}
                      onChange={e => setEditingPost({...editingPost, title: e.target.value})}
                      required
                    />
                    <textarea
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs outline-none h-80"
                      value={editingPost.content}
                      onChange={e => setEditingPost({...editingPost, content: e.target.value})}
                      required
                    />
                    <button type="submit" className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-xs shadow-lg">수정완료</button>
                  </form>
                </div>
              )}

              {boardView === 'detail' && selectedPost && (
                <div className={`space-y-4 ${isBoardMaximized ? 'max-w-4xl mx-auto' : ''}`}>
                  <div className="flex items-center gap-1.5 mb-2 text-blue-600 cursor-pointer text-xs font-bold uppercase" onClick={() => setBoardView('list')}>
                    <ChevronLeft size={16} /> 목록으로
                  </div>
                  <div className="bg-white rounded-[1.5rem] shadow-xl border border-slate-50 p-5">
                    <div className="flex items-center justify-between mb-4 border-b pb-3">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-slate-400" />
                        <h4 className="text-[11px] font-black text-slate-900">{selectedPost.authorName}</h4>
                        <span className="text-[10px] font-bold text-slate-300 uppercase">{new Date(selectedPost.createdAt).toLocaleString()}</span>
                      </div>
                      {(selectedPost.isAuthor || selectedPost.author) && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingPost({ title: selectedPost.title, content: selectedPost.content }); setBoardView('edit'); }} className="p-1.5 text-slate-400 hover:text-blue-600"><PenLine size={14} /></button>
                          <button onClick={handleDeletePost} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                    <h3 className="text-base font-black text-slate-900 mb-3">{selectedPost.title}</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap mb-6">{selectedPost.content}</p>
                    
                    <div className="pt-6 border-t border-slate-50">
                      <h5 className="text-[10px] font-black text-slate-900 mb-4 flex items-center gap-1.5 uppercase">
                        <MessageSquare size={12} className="text-blue-500" /> 댓글 ({selectedPost.comments?.length || 0})
                      </h5>
                      <div className="space-y-2.5 mb-6">
                        {selectedPost.comments?.map(comment => (
                          <div key={comment.commentId} className="bg-slate-50/80 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-black text-blue-600 uppercase">{comment.authorName}</span>
                              {(comment.isAuthor || comment.author) && (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => { setEditingCommentId(comment.commentId); setEditingCommentContent(comment.content); }} className="p-1 text-slate-300 hover:text-blue-600"><PenLine size={10} /></button>
                                  <button onClick={() => handleDeleteComment(comment.commentId)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={10} /></button>
                                </div>
                              )}
                            </div>
                            {editingCommentId === comment.commentId ? (
                              <div className="mt-2 space-y-2">
                                <textarea className="w-full bg-white border border-blue-100 rounded-lg p-2 text-xs" value={editingCommentContent} onChange={e => setEditingCommentContent(e.target.value)} rows={2} />
                                <div className="flex justify-end gap-2 text-[9px] font-black uppercase">
                                  <button onClick={() => setEditingCommentId(null)}>취소</button>
                                  <button onClick={() => handleUpdateComment(comment.commentId)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md">저장</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-slate-700 text-xs font-medium">{comment.content}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <form onSubmit={handleSendComment} className="relative">
                        <input className="w-full bg-slate-50 border rounded-xl py-2.5 pl-4 pr-12 text-xs font-medium" placeholder="댓글을 남겨주세요..." value={newComment} onChange={e => setNewComment(e.target.value)} />
                        <button type="submit" disabled={!newComment.trim()} className="absolute right-1 top-1 p-1.5 bg-blue-600 text-white rounded-xl disabled:opacity-50"><Send size={14} /></button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
};

export default CourseDetailPage;
