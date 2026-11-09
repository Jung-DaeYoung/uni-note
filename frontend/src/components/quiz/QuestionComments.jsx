import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import client from '../../api/client';
import { showAlert, useConfirm } from '../../context/ConfirmContext';
import '../../pages/QuizLibraryPage.css';
import './QuestionComments.css';

// 공유게시판 댓글 목록·작성·수정·삭제. CBT 시험(문제별)과 노트 공유(글별)가 함께 쓴다.
// 목록은 부모가 받아 내려주고, 작성·수정·삭제 결과는 onChange로 이 목록만 갱신한다.
// addUrl: 작성 경로, commentUrl: 수정·삭제 경로 앞부분(뒤에 /{commentId}가 붙는다).
const QuestionComments = ({ addUrl, commentUrl, comments, onChange, placeholder, defaultOpen = false }) => {
  const confirm = useConfirm();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');

  const fail = (err, fallback) => showAlert(err.response?.data?.message || fallback);

  const handleAdd = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await client.post(addUrl, { content: newComment });
      onChange([...comments, res.data]);
      setNewComment('');
    } catch (err) {
      fail(err, '댓글을 작성하지 못했습니다.');
    }
  };

  const handleUpdate = async (commentId) => {
    if (!editingContent.trim()) return;
    try {
      const res = await client.put(`${commentUrl}/${commentId}`, { content: editingContent });
      onChange(comments.map(c => (c.commentId === commentId ? res.data : c)));
      setEditingId(null);
    } catch (err) {
      fail(err, '댓글을 수정하지 못했습니다.');
    }
  };

  const handleDelete = async (commentId) => {
    if (!(await confirm({
      title: '댓글을 삭제할까요?',
      message: '삭제한 댓글은 복구할 수 없습니다.',
      confirmLabel: '댓글 삭제',
    }))) return;
    try {
      await client.delete(`${commentUrl}/${commentId}`);
      onChange(comments.filter(c => c.commentId !== commentId));
    } catch (err) {
      fail(err, '댓글을 삭제하지 못했습니다.');
    }
  };

  return (
    <div className="qc">
      <button onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen} className="qc-link qc-toggle">
        <MessageSquare size={14} aria-hidden="true" /> 댓글 {comments.length}
      </button>

      {isOpen && (
        <>
          <ul className="qc-list">
            {comments.map(comment => (
              <li key={comment.commentId} className="qc-comment">
                <div className="qc-head">
                  <span className="qc-author">{comment.authorName}</span>
                  <span className="qc-meta">
                    <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time>
                    {comment.isAuthor && (
                      <>
                        <button onClick={() => { setEditingId(comment.commentId); setEditingContent(comment.content); }} className="qc-link">수정</button>
                        <button onClick={() => handleDelete(comment.commentId)} className="qc-link qc-link-danger">삭제</button>
                      </>
                    )}
                  </span>
                </div>
                {editingId === comment.commentId ? (
                  <div className="qc-edit">
                    <textarea
                      className="qc-field"
                      value={editingContent}
                      aria-label="댓글 수정"
                      maxLength={255}
                      onChange={e => setEditingContent(e.target.value)}
                      rows={2}
                    />
                    <div className="qc-actions">
                      <button onClick={() => setEditingId(null)} className="qc-link">취소</button>
                      <button onClick={() => handleUpdate(comment.commentId)} className="lib-btn">저장</button>
                    </div>
                  </div>
                ) : (
                  <p className="qc-text">{comment.content}</p>
                )}
              </li>
            ))}
          </ul>

          <div className="qc-form">
            <textarea
              value={newComment}
              aria-label="댓글 작성"
              maxLength={255}
              onChange={e => setNewComment(e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="qc-field"
            />
            <button onClick={handleAdd} disabled={!newComment.trim()} className="lib-btn lib-btn-primary">
              등록
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default QuestionComments;
