import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import client from '../../api/client';
import { noteSchemaExtensions } from '../editor/NotionEditor';
import { NoteTreeProvider, findNote } from '../../context/NoteTreeContext';
import QuestionComments from '../quiz/QuestionComments';
import { showAlert } from '../../context/ConfirmContext';

const parseContent = (content) => {
  try {
    return content ? JSON.parse(content) : null;
  } catch {
    return null;
  }
};

// 노트 한 장을 읽기 전용으로 렌더링한다. 노트가 바뀌면 key로 새로 만든다.
// 본문의 페이지 링크는 공유 범위 안의 노트면 그 노트로 전환한다.
const ReadOnlyNote = ({ content, onOpenNote }) => {
  const editor = useEditor({
    extensions: noteSchemaExtensions,
    editable: false,
    content: parseContent(content),
    editorProps: {
      attributes: { class: 'uninote-editor focus:outline-none text-lg leading-relaxed' },
      handleClickOn: (view, pos, node) => {
        if (node.type.name !== 'pageLink') return false;
        onOpenNote(node.attrs.noteId);
        return true;
      },
    },
  });
  return <EditorContent editor={editor} />;
};

// 루트에서 id 노트까지의 경로(상위 노트 → 현재 노트). 없으면 빈 배열.
const findPath = (nodes, id) => {
  for (const node of nodes || []) {
    if (node.noteId === id) return [node];
    const rest = findPath(node.children, id);
    if (rest.length) return [node, ...rest];
  }
  return [];
};

// 공유 노트 상세: 선택한 노트 본문(읽기 전용) + 댓글. 하위 노트는 본문의 페이지 링크로 들어가고,
// 하위 노트를 볼 때만 위쪽 경로로 상위 노트에 돌아간다. 자동 저장·업로드·노트 생성 기능은 없다(NotionEditor를 쓰지 않음).
const SharedNoteViewer = ({ postId, onBack, onDelete }) => {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      client.get(`/shared-notes/${postId}`),
      client.get(`/shared-notes/${postId}/comments`),
    ])
      .then(([detailRes, commentsRes]) => {
        if (ignore) return;
        setPost(detailRes.data);
        setSelectedId(detailRes.data.notes[0]?.noteId ?? null);
        setComments(commentsRes.data);
      })
      .catch(err => {
        if (ignore) return;
        showAlert(err.response?.data?.message || '공유 노트를 불러오지 못했습니다.');
        onBack();
      });
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  if (!post) return null;

  const path = findPath(post.notes, selectedId);
  const selected = path[path.length - 1];
  const openNote = (noteId) => {
    if (findNote(post.notes, Number(noteId))) setSelectedId(Number(noteId));
  };

  return (
    <NoteTreeProvider noteTree={post.notes}>
      {/* 본문 블록이 화면 기준 fixed를 쓸 수 있어 container-type을 주는 lib-frame으로 감싸지 않는다. */}
      <div className="lib board-viewer">
        <button onClick={onBack} className="board-back">
          목록으로
        </button>

        <header className="board-head">
          <div className="board-head-body">
            <h1 className="lib-title">{post.title || '제목 없음'}</h1>
            <p className="lib-meta">
              <span className="board-course">{post.courseName}</span>
              <span>{post.authorName}{post.isAuthor && ' (나)'}</span>
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
              <span>공유 시점의 내용입니다</span>
            </p>
          </div>
          {post.isAuthor && (
            <button
              onClick={() => onDelete(post)}
              title="게시판에서 내리기"
              aria-label="게시판에서 내리기"
              className="lib-icon lib-icon-danger"
            >
              <Trash2 size={16} />
            </button>
          )}
        </header>

        {path.length > 1 && (
          <nav aria-label="노트 경로" className="board-path">
            {path.map((node, i) => (
              <React.Fragment key={node.noteId}>
                {i > 0 && <span className="board-path-sep" aria-hidden="true">/</span>}
                {i < path.length - 1 ? (
                  <button onClick={() => setSelectedId(node.noteId)} className="board-crumb">
                    {node.title || '제목 없음'}
                  </button>
                ) : (
                  <span>{node.title || '제목 없음'}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <section className="board-note">
          {selected && <ReadOnlyNote key={selected.noteId} content={selected.content} onOpenNote={openNote} />}
        </section>

        <section className="board-comments">
          <QuestionComments
            addUrl={`/shared-notes/${post.sharedNotePostId}/comments`}
            commentUrl="/shared-notes/comments"
            comments={comments}
            onChange={setComments}
            placeholder="이 노트에 대한 질문이나 의견을 남겨 보세요 (익명)"
            defaultOpen
          />
        </section>
      </div>
    </NoteTreeProvider>
  );
};

export default SharedNoteViewer;
