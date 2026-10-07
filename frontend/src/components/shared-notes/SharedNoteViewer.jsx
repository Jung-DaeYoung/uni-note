import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { ArrowLeft, Calendar, FileText, Trash2 } from 'lucide-react';
import client from '../../api/client';
import { noteSchemaExtensions, NoteEditorStyles } from '../editor/NotionEditor';
import { NoteTreeProvider, findNote } from '../../context/NoteTreeContext';
import QuestionComments from '../quiz/QuestionComments';

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

const SnapshotTree = ({ nodes, selectedId, onSelect, depth = 0 }) => (
  <ul>
    {nodes.map(node => (
      <li key={node.noteId}>
        <button
          onClick={() => onSelect(node.noteId)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`w-full flex items-center gap-2 py-1.5 pr-2 rounded-md text-left text-xs font-medium transition-colors ${
            node.noteId === selectedId
              ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <FileText size={12} className="shrink-0" />
          <span className="truncate">{node.title || '제목 없음'}</span>
        </button>
        {node.children?.length > 0 && (
          <SnapshotTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
        )}
      </li>
    ))}
  </ul>
);

// 공유 노트 상세: 공유 시점 스냅샷 트리 + 선택한 노트 본문(읽기 전용) + 댓글.
// 자동 저장·업로드·노트 생성 기능은 없다(NotionEditor를 쓰지 않음).
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
        alert(err.response?.data?.message || '공유 노트를 불러오지 못했습니다.');
        onBack();
      });
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  if (!post) return null;

  const selected = findNote(post.notes, selectedId);
  const openNote = (noteId) => {
    if (findNote(post.notes, Number(noteId))) setSelectedId(Number(noteId));
  };

  return (
    <NoteTreeProvider noteTree={post.notes}>
      <div className="p-8 max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft size={14} /> 목록으로
        </button>

        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md">
              {post.courseName}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{post.title || '제목 없음'}</h1>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-3">
              <span>{post.authorName}{post.isAuthor && ' (나)'}</span>
              <span className="flex items-center gap-1"><Calendar size={12} />{new Date(post.createdAt).toLocaleDateString()}</span>
              <span>공유 시점의 내용입니다</span>
            </p>
          </div>
          {post.isAuthor && (
            <button
              onClick={() => onDelete(post)}
              title="게시판에서 내리기"
              className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          )}
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 shrink-0 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-2 h-fit">
            <SnapshotTree nodes={post.notes} selectedId={selectedId} onSelect={setSelectedId} />
          </aside>

          <section className="flex-1 min-w-0 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 px-6 py-6">
            <NoteEditorStyles />
            {selected && <ReadOnlyNote key={selected.noteId} content={selected.content} onOpenNote={openNote} />}
          </section>
        </div>

        <section className="mt-6 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
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
