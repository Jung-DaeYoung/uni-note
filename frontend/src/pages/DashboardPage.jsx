import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useCourses, termOf, termLabel } from '../context/CourseContext';
import './DashboardPage.css';

const DashboardPage = () => {
  // 사이드바(AppLayout)가 이미 같은 /dashboard/courses 응답을 CourseContext로 불러오므로,
  // 대시보드 페이지에서 동일한 요청을 다시 보내지 않고 그대로 재사용한다.
  const { courses, selectedTerm, recentPosts, recentNotes } = useCourses();
  // 직접 만든 강의는 사이드바 "내가 만든 강의"에서 관리하고, 대시보드에는 사이드바에서 고른 학기의 수강 강의만 보여 준다.
  const enrolledCourses = courses.filter(c => !c.userCreated && termOf(c) === selectedTerm);
  const [leadNote, ...otherNotes] = recentNotes;

  const renderCourse = (course) => (
    <li key={course.courseId}>
      <Link className="dash-row" to={`/course/${course.courseId}`}>
        <span className="dash-title">{course.courseName}</span>
        <span className="dash-meta">
          <span className="dash-code">{course.courseCode}</span>
          <span>{course.professorName} 교수</span>
        </span>
      </Link>
    </li>
  );

  const formatTime = (dateStr) => {
    const now = new Date();
    const past = new Date(dateStr);
    const diff = Math.floor((now - past) / (1000 * 60)); // 분 단위

    if (diff < 1) return '방금 전';
    if (diff < 60) return `${diff}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return `${Math.floor(diff / 1440)}일 전`;
  };

  return (
    <AppLayout>
      <div className="dash-frame">
        <div className="dash">
          <h1 className="sr-only">강의목록</h1>

          <section className="dash-section">
            <h2 className="dash-heading">최근 노트 기록</h2>
            {!leadNote ? (
              <p className="dash-empty">최근 수정한 노트가 없습니다.</p>
            ) : (
              <>
                <Link className="dash-lead" to={`/course/${leadNote.courseId}/note/${leadNote.noteId}`}>
                  <span className="dash-lead-title">{leadNote.title}</span>
                  <span className="dash-lead-meta">
                    <span>{leadNote.courseName}</span>
                    <span>{formatTime(leadNote.updatedAt)}</span>
                  </span>
                </Link>
                <ul className="dash-list">
                  {otherNotes.map((note) => (
                    <li key={note.noteId}>
                      <Link className="dash-row" to={`/course/${note.courseId}/note/${note.noteId}`}>
                        <span className="dash-title">{note.title}</span>
                        <span className="dash-meta">
                          <span>{note.courseName}</span>
                          <span>{formatTime(note.updatedAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="dash-section">
            <h2 className="dash-heading">
              수강 중인 강의{selectedTerm && <span className="dash-term"> · {termLabel(selectedTerm)}</span>}
            </h2>
            {enrolledCourses.length === 0 ? (
              <p className="dash-empty">수강 중인 강의가 없습니다.</p>
            ) : (
              <ul className="dash-list">
                {enrolledCourses.map(renderCourse)}
              </ul>
            )}
          </section>

          <section className="dash-section dash-section-wide">
            <h2 className="dash-heading">최신 커뮤니티 게시글</h2>
            {recentPosts.length === 0 ? (
              <p className="dash-empty">새로운 게시글이 없습니다.</p>
            ) : (
              <ul className="dash-list">
                {recentPosts.slice(0, 5).map((post) => (
                  <li key={post.postId}>
                    <Link className="dash-row dash-post" to={`/course/${post.courseId}?postId=${post.postId}`}>
                      <span className="dash-title">{post.title}</span>
                      <span className="dash-meta">
                        <span>{post.courseName}</span>
                        <span>{post.authorName}</span>
                        <span>{formatTime(post.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
