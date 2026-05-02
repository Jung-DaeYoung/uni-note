import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Plus, 
  ChevronLeft, 
  User, 
  Search, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  PenLine, 
  Send,
  ChevronRight,
  FileText,
  Home,
  FolderOpen
} from 'lucide-react';
import client from '../api/client';
import AppLayout from '../components/layout/AppLayout';
import NotionEditor from '../components/editor/NotionEditor';
import { NoteTreeProvider } from '../context/NoteTreeContext';

// --- Sidebar Tree Item Component ---
const NoteTreeItem = ({ item, courseId, depth = 0, currentNoteId, onDelete }) => {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const hasChildren = item.children && item.children.length > 0;
  const isActive = parseInt(currentNoteId) === item.noteId;

  return (
    <div className="select-none">
      <div 
        className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-200 ${
          isActive 
          ? 'bg-blue-600 shadow-lg shadow-blue-500/20 text-white' 
          : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
        }`}
        style={{ marginLeft: `${depth * 12}px` }}
        onClick={() => navigate(`/course/${courseId}/note/${item.noteId}`)}
      >
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`p-0.5 rounded hover:bg-white/10 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} ${!hasChildren ? 'invisible' : ''}`}
        >
          <ChevronRight size={14} />
        </button>
        {hasChildren ? (
          <FolderOpen size={14} className={isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-blue-400'} />
        ) : (
          <FileText size={14} className={isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-300'} />
        )}
        <span className={`text-[11px] font-bold truncate flex-1 ${isActive ? 'text-white' : ''}`}>
          {item.title || '제목 없음'}
        </span>
        
        {/* Delete Button (Visible on Hover) */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.noteId, item.title);
          }}
          className={`p-1 rounded hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 ${isActive ? 'text-blue-200' : 'text-slate-500'}`}
          title="노트 삭제"
        >
          <Trash2 size={12} />
        </button>
      </div>
      
      {isOpen && hasChildren && (
        <div className="mt-0.5 border-l border-slate-800/50 ml-3">
          {item.children.map(child => (
            <NoteTreeItem 
              key={child.noteId} 
              item={child} 
              courseId={courseId} 
              depth={depth} 
              currentNoteId={currentNoteId}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CourseDetailPage = () => {
  const { courseId, noteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // States
  const [courseName, setCourseName] = useState('');
  const [noteData, setNoteNoteData] = useState(null);
  const [noteTree, setNoteTree] = useState([]);
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

  // Fetch Tree Data
  const fetchTree = useCallback(async () => {
    try {
      const res = await client.get(`/courses/${courseId}/notes/tree`);
      setNoteTree(res.data || []);
      return res.data;
    } catch (error) {
      console.error("트리 로딩 실패", error);
      return [];
    }
  }, [courseId]);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboardRes = await client.get('/dashboard/courses');
        const currentCourse = dashboardRes.data.courses.find(c => c.courseId === parseInt(courseId));
        if (currentCourse) setCourseName(currentCourse.courseName);

        const postsRes = await client.get(`/posts/${courseId}`);
        setPosts(postsRes.data || []);

        const treeData = await fetchTree();

        if (!noteId) {
          if (treeData && treeData.length > 0) {
            navigate(`/course/${courseId}/note/${treeData[0].noteId}`, { replace: true });
          } else {
            const createRes = await client.post(`/courses/${courseId}/notes`);
            navigate(`/course/${courseId}/note/${createRes.data.noteId}`, { replace: true });
          }
        }
      } catch (error) {
        console.error("데이터 로딩 실패", error);
      }
    };
    fetchData();
  }, [courseId, noteId, navigate, fetchTree]);

  // Fetch Specific Note
  useEffect(() => {
    if (!noteId) return;
    const fetchNote = async () => {
      try {
        const res = await client.get(`/notes/${noteId}`);
        setNoteNoteData(res.data);
      } catch (error) {
        console.error("노트 로딩 실패", error);
      }
    };
    fetchNote();
  }, [noteId]);

  const handleCreateRootNote = async () => {
    try {
      const res = await client.post(`/courses/${courseId}/notes`);
      fetchTree();
      navigate(`/course/${courseId}/note/${res.data.noteId}`);
    } catch (error) {
      alert("노트 생성 실패");
    }
  };

  const handleDeleteNote = async (targetId, title) => {
    if (!window.confirm(`'${title}' 노트를 삭제하시겠습니까? 하위 노트도 모두 삭제됩니다.`)) return;
    try {
      await client.delete(`/notes/${targetId}`);
      const updatedTree = await fetchTree();
      
      // 현재 보고 있는 노트가 삭제되었다면 다른 노트로 이동
      if (parseInt(noteId) === targetId) {
        if (updatedTree.length > 0) {
          navigate(`/course/${courseId}/note/${updatedTree[0].noteId}`);
        } else {
          // 남은 노트가 없으면 대시보드로 이동하거나 새 노트 생성
          navigate(`/course/${courseId}`);
        }
      }
    } catch (error) {
      alert("노트 삭제 실패");
    }
  };

  // --- Sidebar Content ---
  const sidebarContent = useMemo(() => (
    <div className="flex flex-col h-full">
      <div className="px-2 mb-4 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Notes</span>
        <button 
          onClick={handleCreateRootNote}
          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
          title="새 노트 추가"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-0.5">
        {noteTree.map(item => (
          <NoteTreeItem 
            key={item.noteId} 
            item={item} 
            courseId={courseId} 
            currentNoteId={noteId} 
            onDelete={handleDeleteNote}
          />
        ))}
      </div>
    </div>
  ), [noteTree, courseId, noteId]);

  // --- Unified Header Content ---
  const headerContent = useMemo(() => (
    <div className="flex items-center justify-between w-full pr-4 h-full">
      <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        <Link to="/dashboard" className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-900 transition-colors">
          <Home size={14} />
        </Link>
        <ChevronRight size={10} className="text-slate-300 shrink-0" />
        <div className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
          <FolderOpen size={12} className="text-blue-500" />
          <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">{courseName}</span>
        </div>
        
        {noteData?.breadcrumbs?.map((bc) => (
          <React.Fragment key={bc.noteId}>
            <ChevronRight size={10} className="text-slate-300 shrink-0" />
            <Link 
              to={`/course/${courseId}/note/${bc.noteId}`}
              className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors truncate max-w-[120px]"
            >
              {bc.title}
            </Link>
          </React.Fragment>
        ))}
        
        {noteData && (
          <>
            <ChevronRight size={10} className="text-slate-300 shrink-0" />
            <span className="text-xs font-black text-slate-900 truncate max-w-[180px]">
              {noteData.title || '제목 없음'}
            </span>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <button 
          onClick={() => setIsBoardOpen(!isBoardOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
            isBoardOpen 
            ? 'bg-slate-900 text-white shadow-inner' 
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <MessageSquare size={12} />
          {isBoardOpen ? '닫기' : '커뮤니티'}
        </button>
      </div>
    </div>
  ), [courseId, courseName, noteData, isBoardOpen]);

  // --- Handlers (Board) ---
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
    <NoteTreeProvider noteTree={noteTree}>
      <AppLayout sidebarContent={sidebarContent} headerContent={headerContent}>
        <div className="flex h-[calc(100vh-48px)] bg-slate-50 overflow-hidden relative font-sans">
          {/* Left: Lecture Note Area */}
          <main className={`flex-1 overflow-y-auto transition-all duration-500 ease-in-out bg-white ${isBoardOpen ? (isBoardMaximized ? 'opacity-0 invisible' : 'mr-[400px]') : 'mr-0'}`}>
            <div className={`mx-auto transition-all duration-500 pt-8 ${isBoardOpen ? 'max-w-4xl' : 'max-w-7xl'}`}>
              <div className="px-8 pb-10">
                {noteId && noteData && noteData.noteId === parseInt(noteId) ? (
                  <NotionEditor key={noteId} noteId={noteId} courseId={courseId} initialData={noteData} onSaved={() => fetchTree()} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-40 opacity-20">
                    <FileText size={64} className="mb-4" />
                    <p className="font-black uppercase tracking-widest">노트를 불러오는 중...</p>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Right Sidebar (Community) */}
          <aside className={`fixed right-0 top-[48px] h-[calc(100vh-48px)] bg-white border-l border-slate-200 shadow-[-10px_0_30px_rgba(0,0,0,0.03)] transition-all duration-500 ease-in-out z-20 flex flex-col ${isBoardOpen ? (isBoardMaximized ? 'w-full translate-x-0' : 'w-[400px] translate-x-0') : 'w-0 translate-x-full'}`}>
            <div className={`${isBoardOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 flex flex-col h-full`}>
              {/* Board Header */}
              <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center shadow-md">
                    <MessageSquare size={14} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 tracking-tight">익명 커뮤니티</h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Community</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {boardView === 'list' && (
                    <button 
                      onClick={() => setBoardView('write')}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-lg transition-all border border-slate-100"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsBoardMaximized(!isBoardMaximized)}
                    className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg transition-all"
                  >
                    {isBoardMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                </div>
              </div>

              <div className={`flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 ${isBoardMaximized ? 'max-w-5xl mx-auto w-full px-10' : ''}`}>
                {boardView === 'list' && (
                  <div className="grid gap-4">
                    {posts.length === 0 ? (
                      <div className="text-center py-20 opacity-20">
                        <Search size={32} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">게시글이 없습니다</p>
                      </div>
                    ) : (
                      posts.map(post => (
                        <button 
                          key={post.postId} 
                          onClick={() => {
                            setSelectedPost(post);
                            setBoardView('detail');
                          }}
                          className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left"
                        >
                          <div className="flex items-center justify-between mb-2 text-[8px] font-black uppercase tracking-widest">
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{post.authorName}</span>
                            <span className="text-slate-300">{new Date(post.createdAt).toLocaleDateString()}</span>
                          </div>
                          <h4 className="text-xs font-black text-slate-900 mb-1 leading-snug">{post.title}</h4>
                          <p className="text-slate-500 text-[10px] line-clamp-2 mb-2 leading-relaxed">{post.content}</p>
                          <div className="flex items-center gap-1 text-slate-400 font-bold text-[8px] uppercase tracking-tighter">
                            <MessageSquare size={10} /> {post.comments?.length || 0} 댓글
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {boardView === 'write' && (
                  <div className="bg-white p-5 rounded-2xl border border-blue-50 shadow-xl">
                    <div className="flex items-center gap-1.5 mb-4 text-blue-600 cursor-pointer text-[10px] font-bold uppercase" onClick={() => setBoardView('list')}>
                      <ChevronLeft size={14} /> 목록으로
                    </div>
                    <form onSubmit={handleSavePost} className="space-y-3">
                      <input 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-xs font-bold outline-none"
                        placeholder="제목을 입력하세요"
                        value={newPost.title}
                        onChange={e => setNewPost({...newPost, title: e.target.value})}
                        required
                      />
                      <textarea 
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-xs outline-none h-64"
                        placeholder="내용을 입력하세요..."
                        value={newPost.content}
                        onChange={e => setNewPost({...newPost, content: e.target.value})}
                        required
                      />
                      <button type="submit" className="w-full bg-blue-600 text-white font-black py-2.5 rounded-xl text-[10px] shadow-lg">등록하기</button>
                    </form>
                  </div>
                )}

                {boardView === 'edit' && (
                  <div className="bg-white p-5 rounded-2xl border border-blue-50 shadow-xl">
                    <div className="flex items-center gap-1.5 mb-4 text-blue-600 cursor-pointer text-[10px] font-bold uppercase" onClick={() => setBoardView('detail')}>
                      <ChevronLeft size={14} /> 수정 취소
                    </div>
                    <form onSubmit={handleUpdatePost} className="space-y-3">
                      <input
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-xs font-bold outline-none"
                        value={editingPost.title}
                        onChange={e => setEditingPost({...editingPost, title: e.target.value})}
                        required
                      />
                      <textarea
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-4 text-xs outline-none h-64"
                        value={editingPost.content}
                        onChange={e => setEditingPost({...editingPost, content: e.target.value})}
                        required
                      />
                      <button type="submit" className="w-full bg-blue-600 text-white font-black py-2.5 rounded-xl text-[10px] shadow-lg">수정완료</button>
                    </form>
                  </div>
                )}

                {boardView === 'detail' && selectedPost && (
                  <div className={`space-y-3 ${isBoardMaximized ? 'max-w-4xl mx-auto' : ''}`}>
                    <div className="flex items-center gap-1.5 mb-1 text-blue-600 cursor-pointer text-[10px] font-bold uppercase" onClick={() => setBoardView('list')}>
                      <ChevronLeft size={14} /> 목록으로
                    </div>
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-50 p-4">
                      <div className="flex items-center justify-between mb-3 border-b pb-2">
                        <div className="flex items-center gap-1.5">
                          <User size={10} className="text-slate-400" />
                          <h4 className="text-[10px] font-black text-slate-900">{selectedPost.authorName}</h4>
                          <span className="text-[8px] font-bold text-slate-300 uppercase">{new Date(selectedPost.createdAt).toLocaleString()}</span>
                        </div>
                        {(selectedPost.isAuthor || selectedPost.author) && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingPost({ title: selectedPost.title, content: selectedPost.content }); setBoardView('edit'); }} className="p-1 text-slate-400 hover:text-blue-600"><PenLine size={12} /></button>
                            <button onClick={handleDeletePost} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-black text-slate-900 mb-2">{selectedPost.title}</h3>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap mb-4 leading-relaxed">{selectedPost.content}</p>
                      
                      <div className="pt-4 border-t border-slate-50">
                        <h5 className="text-[9px] font-black text-slate-900 mb-3 flex items-center gap-1.5 uppercase">
                          <MessageSquare size={10} className="text-blue-500" /> 댓글 ({selectedPost.comments?.length || 0})
                        </h5>
                        <div className="space-y-2 mb-4">
                          {selectedPost.comments?.map(comment => (
                            <div key={comment.commentId} className="bg-slate-50/80 rounded-xl p-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-black text-blue-600 uppercase">{comment.authorName}</span>
                                {(comment.isAuthor || comment.author) && (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => { setEditingCommentId(comment.commentId); setEditingCommentContent(comment.content); }} className="p-1 text-slate-300 hover:text-blue-600"><PenLine size={8} /></button>
                                    <button onClick={() => handleDeleteComment(comment.commentId)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={8} /></button>
                                  </div>
                                )}
                              </div>
                              {editingCommentId === comment.commentId ? (
                                <div className="mt-1 space-y-2">
                                  <textarea className="w-full bg-white border border-blue-100 rounded-lg p-2 text-xs" value={editingCommentContent} onChange={e => setEditingCommentContent(e.target.value)} rows={2} />
                                  <div className="flex justify-end gap-2 text-[8px] font-black uppercase">
                                    <button onClick={() => setEditingCommentId(null)}>취소</button>
                                    <button onClick={() => handleUpdateComment(comment.commentId)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md">저장</button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-slate-700 text-[11px] font-medium leading-normal">{comment.content}</p>
                              )}
                            </div>
                          ))}
                        </div>
                        <form onSubmit={handleSendComment} className="relative">
                          <input className="w-full bg-slate-50 border rounded-xl py-2 pl-3 pr-10 text-[10px] font-medium" placeholder="댓글을 남겨주세요..." value={newComment} onChange={e => setNewComment(e.target.value)} />
                          <button type="submit" disabled={!newComment.trim()} className="absolute right-1 top-1 p-1 bg-blue-600 text-white rounded-lg disabled:opacity-50"><Send size={12} /></button>
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
    </NoteTreeProvider>
  );
};

export default CourseDetailPage;
