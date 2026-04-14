import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, PenLine, Send, MessageSquare, Clock, Plus, ChevronLeft, User, Search, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import client from '../api/client';
import AppLayout from '../components/layout/AppLayout';

const CourseDetailPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // States
  const [courseName, setCourseName] = useState('');
  const [note, setNote] = useState({ content: '' });
  const [posts, setPosts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Board Sidebar State
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isBoardMaximized, setIsBoardMaximized] = useState(false);
  
  // Board Logic States: 'list', 'write', 'detail'
  const [boardView, setBoardView] = useState('list'); 
  const [selectedPost, setSelectedPost] = useState(null);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [newComment, setNewComment] = useState('');

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboardRes = await client.get('/dashboard/courses');
        const currentCourse = dashboardRes.data.courses.find(c => c.courseId === parseInt(courseId));
        if (currentCourse) setCourseName(currentCourse.courseName);

        const [noteRes, postsRes] = await Promise.all([
          client.get(`/notes/${courseId}`),
          client.get(`/posts/${courseId}`)
        ]);
        
        if (noteRes.data) {
          setNote({ content: noteRes.data.content || '' });
        }
        
        const fetchedPosts = postsRes.data || [];
        setPosts(fetchedPosts);

        // URL에서 postId 파라미터 확인 및 자동 이동
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

  // Simple Auto-save Note
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (!note.content) return;
      setIsSaving(true);
      try {
        await client.post(`/notes/${courseId}`, note);
      } finally {
        setTimeout(() => setIsSaving(false), 1000);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [note, courseId]);

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

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedPost) return;
    try {
      await client.post(`/posts/${selectedPost.postId}/comments`, { content: newComment });
      
      const postsRes = await client.get(`/posts/${courseId}`);
      setPosts(postsRes.data);
      
      const updatedPost = postsRes.data.find(p => p.postId === selectedPost.postId);
      setSelectedPost(updatedPost);
      setNewComment('');
    } catch (error) {
      alert("댓글 작성에 실패했습니다.");
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
            <header className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{courseName}</h1>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-[0.3em]">Workspace</p>
              </div>
              <div className="flex items-center gap-3">
                {isSaving && <span className="text-[9px] font-bold text-blue-500 animate-pulse uppercase tracking-widest">Saving...</span>}
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
              <section className="relative group">
                <textarea 
                  className="w-full bg-slate-50/50 rounded-[2rem] p-10 border-2 border-transparent focus:border-blue-500/10 focus:bg-white transition-all text-slate-800 text-lg leading-relaxed min-h-[700px] outline-none shadow-sm group-hover:shadow-xl placeholder:text-slate-300"
                  placeholder="오늘의 강의 내용을 자유롭게 기록하세요..."
                  value={note.content || ''}
                  onChange={(e) => setNote({ content: e.target.value })}
                />
              </section>
            </div>
          </div>
        </main>

        {/* Right: Modern Bulletin Board Sidebar (Drawer Style) */}
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
                    title="글쓰기"
                  >
                    <Plus size={16} />
                  </button>
                )}
                <button 
                  onClick={() => setIsBoardMaximized(!isBoardMaximized)}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg transition-all"
                  title={isBoardMaximized ? "축소하기" : "전체화면"}
                >
                  {isBoardMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/30 ${isBoardMaximized ? 'max-w-5xl mx-auto w-full px-10' : ''}`}>
              {/* VIEW: LIST */}
              {boardView === 'list' && (
                <div className="grid gap-4">
                  {posts.length === 0 ? (
                    <div className="text-center py-20 opacity-20">
                      <Search size={40} className="mx-auto mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest">No Posts</p>
                    </div>
                  ) : (
                    posts.map(post => (
                      <button 
                        key={post.postId} 
                        onClick={() => {
                          setSelectedPost(post);
                          setBoardView('detail');
                        }}
                        className="bg-white p-5 rounded-[1.2rem] border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[9px] font-black px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md uppercase tracking-widest">
                            {post.authorName}
                          </span>
                          <span className="text-[9px] font-bold text-slate-300">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors leading-snug">
                          {post.title}
                        </h4>
                        <p className="text-slate-500 text-xs line-clamp-2 mb-3 leading-relaxed">
                          {post.content}
                        </p>
                        <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[9px] uppercase tracking-tighter">
                          <MessageSquare size={10} />
                          {post.comments?.length || 0} Comments
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* VIEW: WRITE */}
              {boardView === 'write' && (
                <div className="bg-white p-6 rounded-[1.5rem] border border-blue-50 shadow-xl">
                  <div className="flex items-center gap-1.5 mb-6 text-blue-600 cursor-pointer" onClick={() => setBoardView('list')}>
                    <ChevronLeft size={16} />
                    <span className="text-xs font-bold uppercase">Back to List</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-6 tracking-tight">Write Post</h3>
                  <form onSubmit={handleSavePost} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-blue-500/20 transition-all outline-none"
                        placeholder="제목을 입력하세요"
                        value={newPost.title}
                        onChange={e => setNewPost({...newPost, title: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Content</label>
                      <textarea 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-medium placeholder:text-slate-300 focus:bg-white focus:border-blue-500/20 transition-all outline-none h-32 resize-none"
                        placeholder="자유롭게 의견을 나누세요..."
                        value={newPost.content}
                        onChange={e => setNewPost({...newPost, content: e.target.value})}
                        required
                      />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">
                      등록하기
                    </button>
                  </form>
                </div>
              )}

              {/* VIEW: DETAIL */}
              {boardView === 'detail' && selectedPost && (
                <div className={`space-y-4 ${isBoardMaximized ? 'max-w-4xl mx-auto' : ''}`}>
                  <div className="flex items-center gap-1.5 mb-2 text-blue-600 cursor-pointer" onClick={() => setBoardView('list')}>
                    <ChevronLeft size={isBoardMaximized ? 18 : 16} />
                    <span className={`${isBoardMaximized ? 'text-xs' : 'text-[10px]'} font-bold uppercase`}>Back to List</span>
                  </div>
                  
                  <div className={`bg-white rounded-[1.5rem] shadow-xl border border-slate-50 relative ${isBoardMaximized ? 'p-8' : 'p-5'}`}>
                    <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                          <User size={12} className="text-slate-400" />
                        </div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[11px] font-black text-slate-900">{selectedPost.authorName}</h4>
                          <span className="text-slate-200 text-[10px]">|</span>
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{new Date(selectedPost.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      {selectedPost.isAuthor && (
                        <button 
                          onClick={handleDeletePost}
                          className="p-1.5 hover:bg-red-50 text-slate-200 hover:text-red-500 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <h3 className={`${isBoardMaximized ? 'text-xl' : 'text-base'} font-black text-slate-900 mb-3 leading-tight`}>{selectedPost.title}</h3>
                    <p className={`${isBoardMaximized ? 'text-base' : 'text-sm'} text-slate-600 leading-relaxed whitespace-pre-wrap mb-6`}>{selectedPost.content}</p>
                    
                    <div className="pt-6 border-t border-slate-50">
                      <h5 className="text-[10px] font-black text-slate-900 mb-4 flex items-center gap-1.5 uppercase tracking-widest">
                        <MessageSquare size={12} className="text-blue-500" />
                        Comments ({selectedPost.comments?.length || 0})
                      </h5>
                      
                      <div className="space-y-2.5 mb-6">
                        {selectedPost.comments?.map(comment => (
                          <div key={comment.commentId} className={`bg-slate-50/80 rounded-xl ${isBoardMaximized ? 'p-4' : 'p-3'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{comment.authorName}</span>
                              <span className="text-[9px] font-bold text-slate-300">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-slate-700 text-xs font-medium leading-relaxed">{comment.content}</p>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleSendComment} className="relative group">
                        <input 
                          className={`w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-4 pr-12 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:border-blue-500/20 transition-all outline-none text-xs font-medium`}
                          placeholder="댓글을 남겨주세요..."
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                        />
                        <button 
                          type="submit" 
                          disabled={!newComment.trim()}
                          className="absolute right-1 top-1 p-1.5 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Send size={14} />
                        </button>
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
