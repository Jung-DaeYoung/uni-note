import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Calendar, Eye, Share2, ThumbsUp, Trash2 } from 'lucide-react';
import CBTPlayer from '../components/editor/components/CBTPlayer';
import { useCourses } from '../context/CourseContext';
import useSharedQuizzes from '../hooks/useSharedQuizzes';

const SORT_TABS = [
  { key: 'latest', label: '최신순' },
  { key: 'likes', label: '추천순' },
  { key: 'views', label: '조회순' },
];

const SharedQuizBoardPage = () => {
  const { courses } = useCourses();
  const {
    sort, setSort,
    courseId, setCourseId,
    posts,
    isLoading,
    selectedQuiz, setSelectedQuiz,
    toggleLike,
    openQuiz,
    deletePost,
  } = useSharedQuizzes();

  return (
    <AppLayout>
      {selectedQuiz && (
        <CBTPlayer
          quizData={selectedQuiz}
          onClose={() => setSelectedQuiz(null)}
          mode="solve"
          courseId={selectedQuiz.courseId}
          sharedQuizId={selectedQuiz.sharedQuizId}
        />
      )}

      <div className="p-8 max-w-5xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">CBT 시험 공유게시판</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">같은 강의 수강생이 공유한 시험을 풀고, 틀린 문제는 오답노트에 담아 보세요.</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="강의 필터"
              className="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2"
            >
              <option value="">전체 강의</option>
              {courses.map(c => (
                <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
              ))}
            </select>

            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
              {SORT_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSort(tab.key)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${sort === tab.key ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {!isLoading && posts.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
            <Share2 size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
            <p className="font-medium text-slate-400 dark:text-slate-500 text-sm">아직 공유된 시험이 없습니다.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">나의 CBT 시험에서 퀴즈를 공유할 수 있습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map(post => (
              <div key={post.sharedQuizId} className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors group">
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
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{post.title}</h3>
                  <span className="shrink-0 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md">{post.difficulty}</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 font-medium flex items-center gap-3 flex-wrap">
                  <span>{post.authorName}{post.isAuthor && ' (나)'}</span>
                  <span>{post.questionCount}문항</span>
                  <span className="flex items-center gap-1"><Eye size={12} />{post.viewCount}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} />{new Date(post.createdAt).toLocaleDateString()}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => openQuiz(post)}
                    className="flex-1 py-2.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors active:scale-[0.98]"
                  >
                    풀기
                  </button>
                  <button
                    onClick={() => toggleLike(post)}
                    aria-pressed={post.liked}
                    aria-label={post.liked ? '추천 취소' : '추천'}
                    className={`px-4 py-2.5 border text-xs font-semibold rounded-lg transition-colors active:scale-[0.98] flex items-center gap-1.5 ${post.liked
                      ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/40 text-blue-600 dark:text-blue-400'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  >
                    <ThumbsUp size={14} fill={post.liked ? 'currentColor' : 'none'} />
                    {post.likeCount}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SharedQuizBoardPage;
