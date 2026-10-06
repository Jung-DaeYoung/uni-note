import React, { useState } from 'react';
import { MessageSquare, PenLine, Trash2 } from 'lucide-react';
import client from '../../api/client';

// CBT 시험 공유게시판 결과 화면의 문제별 댓글. 목록은 CBTPlayer가 글 단위로 한 번 받아 내려주고,
// 작성·수정·삭제 결과는 onChange로 이 문제의 목록만 갱신한다.
const QuestionComments = ({ sharedQuizId, questionId, comments, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');

  const fail = (err, fallback) => alert(err.response?.data?.message || fallback);

  const handleAdd = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await client.post(`/shared-quizzes/${sharedQuizId}/questions/${questionId}/comments`, { content: newComment });
      onChange([...comments, res.data]);
      setNewComment('');
    } catch (err) {
      fail(err, '댓글을 작성하지 못했습니다.');
    }
  };

  const handleUpdate = async (commentId) => {
    if (!editingContent.trim()) return;
    try {
      const res = await client.put(`/shared-quizzes/comments/${commentId}`, { content: editingContent });
      onChange(comments.map(c => (c.commentId === commentId ? res.data : c)));
      setEditingId(null);
    } catch (err) {
      fail(err, '댓글을 수정하지 못했습니다.');
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('댓글을 삭제할까요?')) return;
    try {
      await client.delete(`/shared-quizzes/comments/${commentId}`);
      onChange(comments.filter(c => c.commentId !== commentId));
    } catch (err) {
      fail(err, '댓글을 삭제하지 못했습니다.');
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsOpen(open => !open)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <MessageSquare size={12} /> 댓글 {comments.length}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2">
          {comments.map(comment => (
            <div key={comment.commentId} className="bg-slate-50/80 dark:bg-slate-800/80 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{comment.authorName}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(comment.createdAt).toLocaleString()}</span>
                  {comment.isAuthor && (
                    <>
                      <button onClick={() => { setEditingId(comment.commentId); setEditingContent(comment.content); }} title="수정" className="p-1 text-slate-300 dark:text-slate-600 hover:text-blue-600 dark:hover:text-blue-400"><PenLine size={10} /></button>
                      <button onClick={() => handleDelete(comment.commentId)} title="삭제" className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400"><Trash2 size={10} /></button>
                    </>
                  )}
                </div>
              </div>
              {editingId === comment.commentId ? (
                <div className="space-y-1.5">
                  <textarea
                    className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 rounded-md p-2 text-xs text-slate-900 dark:text-slate-100"
                    value={editingContent}
                    maxLength={255}
                    onChange={e => setEditingContent(e.target.value)}
                    rows={2}
                  />
                  <div className="flex justify-end gap-2 text-[11px] font-semibold">
                    <button onClick={() => setEditingId(null)} className="text-slate-500 dark:text-slate-400">취소</button>
                    <button onClick={() => handleUpdate(comment.commentId)} className="text-blue-600 dark:text-blue-400">저장</button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{comment.content}</p>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <textarea
              value={newComment}
              maxLength={255}
              onChange={e => setNewComment(e.target.value)}
              placeholder="이 문제에 대한 질문이나 풀이를 남겨 보세요 (익명)"
              rows={2}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2 text-xs text-slate-900 dark:text-slate-100"
            />
            <button
              onClick={handleAdd}
              disabled={!newComment.trim()}
              className="px-3 rounded-md text-xs font-semibold bg-slate-900 dark:bg-slate-700 text-white disabled:opacity-40"
            >
              등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionComments;
