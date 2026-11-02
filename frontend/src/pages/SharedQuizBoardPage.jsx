import React from 'react';
import AppLayout from '../components/layout/AppLayout';
import { ThumbsUp, Trash2 } from 'lucide-react';
import CBTPlayer from '../components/editor/components/CBTPlayer';
import { useCourses } from '../context/CourseContext';
import useSharedQuizzes from '../hooks/useSharedQuizzes';
import './QuizLibraryPage.css';
import './SharedBoard.css';

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

      <div className="lib-frame">
        <div className="lib">
          <h1 className="lib-title">CBT 시험 공유게시판</h1>

          <div className="lib-tabs board-bar">
            <div className="board-sorts">
              {SORT_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSort(tab.key)}
                  aria-pressed={sort === tab.key}
                  className="lib-tab"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="강의 필터"
              className="lib-select"
            >
              <option value="">전체 강의</option>
              {courses.filter(c => !c.userCreated).map(c => (
                <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
              ))}
            </select>
          </div>

          {!isLoading && posts.length === 0 ? (
            <p className="lib-empty board-list">
              아직 공유된 시험이 없습니다.
              <span className="board-hint">나의 CBT 시험에서 퀴즈를 공유할 수 있습니다.</span>
            </p>
          ) : (
            <ul className="lib-list board-list">
              {posts.map(post => (
                <li key={post.sharedQuizId} className="lib-quiz">
                  <div className="lib-quiz-body">
                    <h2 className="lib-item-title">{post.title}</h2>
                    <p className="lib-meta">
                      <span className="board-course">{post.courseName}</span>
                      <span>{post.difficulty}</span>
                      <span>{post.authorName}{post.isAuthor && ' (나)'}</span>
                      <span>{post.questionCount}문항</span>
                      <span>조회 {post.viewCount}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <div className="lib-actions board-actions">
                    {post.isAuthor && (
                      <div className="lib-icons">
                        <button
                          onClick={() => deletePost(post)}
                          title="게시판에서 내리기"
                          aria-label={`${post.title} 게시판에서 내리기`}
                          className="lib-icon lib-icon-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => toggleLike(post)}
                      aria-pressed={post.liked}
                      aria-label={post.liked ? '추천 취소' : '추천'}
                      className="lib-btn board-like"
                    >
                      <ThumbsUp size={14} fill={post.liked ? 'currentColor' : 'none'} />
                      {post.likeCount}
                    </button>
                    <button onClick={() => openQuiz(post)} className="lib-btn lib-btn-primary">
                      풀기
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default SharedQuizBoardPage;
