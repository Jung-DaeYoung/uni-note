import React from 'react';
import '../../pages/QuizLibraryPage.css';
import './CourseBoardPanel.css';

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
    <aside className={`board ${isBoardMaximized ? 'board-wide' : ''} ${isBoardOpen ? 'board-open' : ''}`}>
      <header className="board-header">
        <h3 className="board-title">익명 커뮤니티</h3>
        <div className="board-header-actions">
          {boardView === 'list' && (
            <button onClick={() => setBoardView('write')} className="lib-btn">
              글쓰기
            </button>
          )}
          <button onClick={() => setIsBoardMaximized(!isBoardMaximized)} className="lib-btn">
            {isBoardMaximized ? '좁게 보기' : '넓게 보기'}
          </button>
        </div>
      </header>

      <div className="board-scroll custom-scrollbar">
        <div className="board-body">
          {boardView === 'list' && (
            posts.length === 0 ? (
              <p className="board-empty">게시글이 없습니다</p>
            ) : (
              <ul className="board-list">
                {posts.map(post => (
                  <li key={post.postId}>
                    <button
                      onClick={() => {
                        setSelectedPost(post);
                        setBoardView('detail');
                      }}
                      className="board-post"
                    >
                      <span className="board-post-title">{post.title}</span>
                      <span className="board-post-excerpt">{post.content}</span>
                      <span className="board-meta">
                        <span>{post.authorName}</span>
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                        <span>{post.comments?.length || 0} 댓글</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          {boardView === 'write' && (
            <>
              <button onClick={() => setBoardView('list')} className="board-back">목록으로</button>
              <form onSubmit={handleSavePost} className="board-form">
                <input
                  className="board-field"
                  aria-label="제목"
                  placeholder="제목을 입력하세요"
                  value={newPost.title}
                  onChange={e => setNewPost({...newPost, title: e.target.value})}
                  required
                />
                <textarea
                  className="board-field board-textarea"
                  aria-label="내용"
                  placeholder="내용을 입력하세요..."
                  value={newPost.content}
                  onChange={e => setNewPost({...newPost, content: e.target.value})}
                  required
                />
                <button type="submit" className="lib-btn lib-btn-primary">등록하기</button>
              </form>
            </>
          )}

          {boardView === 'edit' && (
            <>
              <button onClick={() => setBoardView('detail')} className="board-back">수정 취소</button>
              <form onSubmit={handleUpdatePost} className="board-form">
                <input
                  className="board-field"
                  aria-label="제목"
                  value={editingPost.title}
                  onChange={e => setEditingPost({...editingPost, title: e.target.value})}
                  required
                />
                <textarea
                  className="board-field board-textarea"
                  aria-label="내용"
                  value={editingPost.content}
                  onChange={e => setEditingPost({...editingPost, content: e.target.value})}
                  required
                />
                <button type="submit" className="lib-btn lib-btn-primary">수정완료</button>
              </form>
            </>
          )}

          {boardView === 'detail' && selectedPost && (
            <>
              <button onClick={() => setBoardView('list')} className="board-back">목록으로</button>
              <article className="board-article">
                <h4 className="board-article-title">{selectedPost.title}</h4>
                <div className="board-article-meta">
                  <p className="board-meta">
                    <span>{selectedPost.authorName}</span>
                    <span>{new Date(selectedPost.createdAt).toLocaleString()}</span>
                  </p>
                  {(selectedPost.isAuthor || selectedPost.author) && (
                    <div className="board-row-actions">
                      <button onClick={() => { setEditingPost({ title: selectedPost.title, content: selectedPost.content }); setBoardView('edit'); }} className="board-link">수정</button>
                      <button onClick={handleDeletePost} className="board-link board-link-danger">삭제</button>
                    </div>
                  )}
                </div>
                <p className="board-content">{selectedPost.content}</p>
              </article>

              <section className="board-comments">
                <h5 className="board-comments-title">댓글 ({selectedPost.comments?.length || 0})</h5>
                <ul className="board-list">
                  {selectedPost.comments?.map(comment => (
                    <li key={comment.commentId} className="board-comment">
                      <div className="board-comment-head">
                        <span className="board-comment-author">{comment.authorName}</span>
                        {(comment.isAuthor || comment.author) && (
                          <div className="board-row-actions">
                            <button onClick={() => { setEditingCommentId(comment.commentId); setEditingCommentContent(comment.content); }} className="board-link">수정</button>
                            <button onClick={() => handleDeleteComment(comment.commentId)} className="board-link board-link-danger">삭제</button>
                          </div>
                        )}
                      </div>
                      {editingCommentId === comment.commentId ? (
                        <div className="board-comment-edit">
                          <textarea
                            className="board-field"
                            aria-label="댓글 수정"
                            value={editingCommentContent}
                            onChange={e => setEditingCommentContent(e.target.value)}
                            rows={2}
                          />
                          <div className="board-row-actions">
                            <button onClick={() => setEditingCommentId(null)} className="board-link">취소</button>
                            <button onClick={() => handleUpdateComment(comment.commentId)} className="lib-btn">저장</button>
                          </div>
                        </div>
                      ) : (
                        <p className="board-comment-text">{comment.content}</p>
                      )}
                    </li>
                  ))}
                </ul>
                <form onSubmit={handleSendComment} className="board-comment-form">
                  <input
                    className="board-field"
                    aria-label="댓글"
                    placeholder="댓글을 남겨주세요..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                  <button type="submit" disabled={!newComment.trim()} className="lib-btn lib-btn-primary">등록</button>
                </form>
              </section>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

export default CourseBoardPanel;
