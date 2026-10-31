import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import SharedNoteViewer from '../components/shared-notes/SharedNoteViewer';
import { useCourses } from '../context/CourseContext';
import useSharedNotes from '../hooks/useSharedNotes';
import './QuizLibraryPage.css';
import './SharedBoard.css';

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
      <div className="lib-frame">
        <div className="lib">
          <h1 className="lib-title">노트 공유 게시판</h1>

          <div className="lib-tabs board-bar">
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="강의 필터"
              className="lib-select board-bar-end"
            >
              <option value="">전체 강의</option>
              {courses.filter(c => !c.userCreated).map(c => (
                <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
              ))}
            </select>
          </div>

          {!isLoading && posts.length === 0 ? (
            <p className="lib-empty board-list">
              아직 공유된 노트가 없습니다.
              <span className="board-hint">노트 화면 상단의 노트 공유 버튼으로 공유할 수 있습니다.</span>
            </p>
          ) : (
            <ul className="lib-list board-list">
              {posts.map(post => (
                <li key={post.sharedNotePostId} className="lib-quiz">
                  <div className="lib-quiz-body">
                    <h2 className="lib-item-title">{post.title || '제목 없음'}</h2>
                    <p className="lib-meta">
                      <span className="board-course">{post.courseName}</span>
                      <span>{post.authorName}{post.isAuthor && ' (나)'}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <div className="lib-actions board-actions">
                    {post.isAuthor && (
                      <div className="lib-icons">
                        <button
                          onClick={() => deletePost(post)}
                          title="게시판에서 내리기"
                          aria-label={`${post.title || '제목 없음'} 게시판에서 내리기`}
                          className="lib-icon lib-icon-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/shared-notes/${post.sharedNotePostId}`)}
                      className="lib-btn lib-btn-primary"
                    >
                      읽기
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

export default SharedNoteBoardPage;
