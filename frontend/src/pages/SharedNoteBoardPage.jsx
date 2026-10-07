import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, FileText, Trash2 } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import SharedNoteViewer from '../components/shared-notes/SharedNoteViewer';
import { useCourses } from '../context/CourseContext';
import useSharedNotes from '../hooks/useSharedNotes';

// 노트 공유 게시판. /shared-notes는 목록, /shared-notes/:postId는 읽기 전용 상세다.
const SharedNoteBoardPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { courses } = useCourses();
  const { courseId, setCourseId, posts, isLoading, deletePost } = useSharedNotes();

  const backToList = () => navigate('/shared-notes');

  if (postId) {
    return (
      <AppLayout>
        <SharedNoteViewer
          key={postId}
          postId={postId}
          onBack={backToList}
          onDelete={async (post) => { if (await deletePost(post)) backToList(); }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">노트 공유 게시판</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">같은 강의 수강생이 공유한 노트를 읽고 댓글로 의견을 나눠 보세요.</p>
          </div>

          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            aria-label="강의 필터"
            className="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2 w-fit"
          >
            <option value="">전체 강의</option>
            {courses.map(c => (
              <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
            ))}
          </select>
        </header>

        {!isLoading && posts.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
            <FileText size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
            <p className="font-medium text-slate-400 dark:text-slate-500 text-sm">아직 공유된 노트가 없습니다.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">노트 화면 상단의 노트 공유 버튼으로 공유할 수 있습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map(post => (
              <div key={post.sharedNotePostId} className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors group">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md">
                    {post.courseName}
                  </span>
                  {post.isAuthor && (
                    <button
                      onClick={() => deletePost(post)}
                      title="게시판에서 내리기"
                      className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{post.title || '제목 없음'}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 font-medium flex items-center gap-3 flex-wrap">
                  <span>{post.authorName}{post.isAuthor && ' (나)'}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} />{new Date(post.createdAt).toLocaleDateString()}</span>
                </p>
                <button
                  onClick={() => navigate(`/shared-notes/${post.sharedNotePostId}`)}
                  className="w-full py-2.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors active:scale-[0.98]"
                >
                  읽기
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SharedNoteBoardPage;
