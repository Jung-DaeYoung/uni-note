import React from 'react';
import {
  ChevronLeft,
  MessageSquare,
  Maximize2,
  Minimize2,
  PenLine,
  Plus,
  Search,
  Send,
  Trash2,
  User,
} from 'lucide-react';

const CourseBoardPanel = ({
  isBoardOpen,
  isBoardMaximized,
  setIsBoardMaximized,
  posts,
  boardView,
  setBoardView,
  selectedPost,
  setSelectedPost,
  newPost,
  setNewPost,
  editingPost,
  setEditingPost,
  newComment,
  setNewComment,
  editingCommentId,
  setEditingCommentId,
  editingCommentContent,
  setEditingCommentContent,
  handleSavePost,
  handleUpdatePost,
  handleSendComment,
  handleUpdateComment,
  handleDeleteComment,
  handleDeletePost,
}) => {
  return (
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
  );
};

export default CourseBoardPanel;
