import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ActivityHeatmap from '../components/mypage/ActivityHeatmap';
import client from '../api/client';
import './QuizLibraryPage.css';
import './MyPage.css';

const SUMMARY_ITEMS = [
  { key: 'noteCount', label: '작성한 노트' },
  { key: 'quizSetCount', label: '생성한 퀴즈' },
  { key: 'attemptCount', label: '퀴즈 풀이' },
  { key: 'incorrectNoteCount', label: '오답노트 문제' },
  { key: 'postCount', label: '게시글' },
  { key: 'commentCount', label: '댓글' },
  { key: 'sharedCount', label: '공유한 콘텐츠' },
];

// 공유 시험은 상세 라우트가 없어 목록으로 보낸다. 게시판 글·댓글은 대시보드처럼 ?postId=로 강의 게시판의 글을 연다.
const ACTIVITY_TYPES = {
  NOTE_CREATED: { label: '노트 작성', to: a => `/course/${a.courseId}/note/${a.targetId}` },
  NOTE_UPDATED: { label: '노트 수정', to: a => `/course/${a.courseId}/note/${a.targetId}` },
  POST_CREATED: { label: '게시글 작성', to: a => `/course/${a.courseId}?postId=${a.targetId}` },
  COMMENT_CREATED: { label: '댓글 작성', to: a => `/course/${a.courseId}?postId=${a.targetId}` },
  SHARED_NOTE_COMMENTED: { label: '공유 노트 댓글', to: a => `/shared-notes/${a.targetId}` },
  SHARED_QUIZ_COMMENTED: { label: '공유 시험 댓글', to: () => '/shared-quizzes' },
  QUIZ_GENERATED: { label: '퀴즈 생성', to: () => '/quizzes' },
  QUIZ_ATTEMPTED: { label: '퀴즈 풀이', to: () => '/quizzes' },
  INCORRECT_NOTE_ADDED: { label: '오답노트 담기', to: () => '/incorrect-notes' },
  NOTE_SHARED: { label: '노트 공유', to: a => `/shared-notes/${a.targetId}` },
  QUIZ_SHARED: { label: '시험 공유', to: () => '/shared-quizzes' },
};

const ACTIVITIES_PER_PAGE = 5;

const formatDateTime =(value) => (value ? value.slice(0, 16).replace('T', ' ') : '-');

const ContentList = ({ title, items, empty }) => (
  <div>
    <h3 className="my-content-title">{title}</h3>
    {items.length === 0 ? (
      <p className="lib-empty">{empty}</p>
    ) : (
      <ul className="lib-list">
        {items.map(item => (
          <li key={item.key}>
            <Link to={item.to} className="my-row my-content-row">
              <span className="my-row-title">{item.title}</span>
              <span className="my-row-meta">{formatDateTime(item.at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const MyPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activityPage, setActivityPage] = useState(1);

  useEffect(() => {
    client.get('/mypage')
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.message || '마이페이지 정보를 불러오지 못했습니다.');
      });
  }, []);

  const totalActivities = data ? data.heatmap.reduce((sum, d) => sum + d.count, 0) : 0;
  // 서버가 최대 RECENT_ACTIVITY_LIMIT(20)개를 한 번에 주므로 화면에서만 나눈다.
  const activities = data?.recentActivities ?? [];
  const activityPageCount = Math.ceil(activities.length / ACTIVITIES_PER_PAGE);
  const activityOffset = (activityPage - 1) * ACTIVITIES_PER_PAGE;
  const pagedActivities = activities.slice(activityOffset, activityOffset + ACTIVITIES_PER_PAGE);

  return (
    <AppLayout>
      <div className="lib-frame">
        <div className="lib">
          {error ? (
            <p className="my-error" role="alert">{error}</p>
          ) : !data ? (
            <p className="lib-empty">불러오는 중…</p>
          ) : (
            <>
              {/* 프로필 */}
              <h1 className="lib-title">{data.profile.name}</h1>
              <p className="my-student-num">{data.profile.studentNum}</p>

              {/* 넓은 화면: 왼쪽 히트맵, 오른쪽 통계 */}
              <div className="my-top">
                {/* 활동 히트맵 (학기 범위) */}
                <section className="my-section">
                  <div className="my-heading-row">
                    <h2 className="lib-heading">{data.semester.label} 학습 활동</h2>
                    <p className="my-heading-meta">
                      <span>{data.semester.startDate} ~ {data.semester.endDate}</span>
                      <span>총 {totalActivities}회</span>
                    </p>
                  </div>
                  <div className="my-heat-body">
                    <ActivityHeatmap startDate={data.semester.startDate} endDate={data.semester.endDate} heatmap={data.heatmap} />
                    {totalActivities === 0 && (
                      <p className="my-heat-note">이번 학기 활동 기록이 아직 없습니다.</p>
                    )}
                  </div>
                </section>

                {/* 통계 (전체 누적) */}
                <section className="my-section">
                  <h2 className="lib-heading">전체 학습 통계</h2>
                  <dl className="my-stats">
                    {SUMMARY_ITEMS.map(({ key, label }) => (
                      <div key={key} className="my-stat">
                        <dt>{label}</dt>
                        <dd>{data.summary[key]}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>

              {/* 강의별 현황 */}
              <section className="my-section">
                <h2 className="lib-heading">강의별 학습 현황</h2>
                {data.courseProgress.length === 0 ? (
                  <p className="lib-empty">수강 중인 강의가 없습니다.</p>
                ) : (
                  <ul className="lib-list">
                    {data.courseProgress.map(course => (
                      <li key={course.courseId}>
                        <Link to={`/course/${course.courseId}`} className="my-row my-course-row">
                          <span className="my-row-title">{course.courseName}</span>
                          <span className="my-row-meta my-counts">
                            <span>노트 {course.noteCount}</span>
                            <span>퀴즈 {course.quizSetCount}</span>
                            <span>풀이 {course.attemptCount}</span>
                          </span>
                          <span className="my-row-meta">
                            최근 활동 {course.lastActivityAt ? formatDateTime(course.lastActivityAt) : '없음'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 최근 활동 */}
              <section className="my-section">
                <h2 className="lib-heading">최근 활동</h2>
                {data.recentActivities.length === 0 ? (
                  <p className="lib-empty">최근 활동이 없습니다.</p>
                ) : (
                  <>
                    <ul className="lib-list">
                      {pagedActivities.map((activity, i) => {
                        const type = ACTIVITY_TYPES[activity.type];
                        return (
                          <li key={`${activity.type}-${activity.targetId}-${activityOffset + i}`}>
                            <Link to={type ? type.to(activity) : '/mypage'} className="my-row my-activity-row">
                              <span className="my-activity-type">{type?.label ?? activity.type}</span>
                              <span className="my-row-title">{activity.title || '(제목 없음)'}</span>
                              <span className="my-row-meta">{formatDateTime(activity.occurredAt)}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    {activityPageCount > 1 && (
                      <nav aria-label="최근 활동 페이지" className="my-pages">
                        {Array.from({ length: activityPageCount }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setActivityPage(page)}
                            aria-current={page === activityPage ? 'page' : undefined}
                            className="my-page"
                          >
                            {page}
                          </button>
                        ))}
                      </nav>
                    )}
                  </>
                )}
              </section>

              {/* 내 콘텐츠 */}
              <section className="my-section">
                <h2 className="lib-heading">내 콘텐츠</h2>
                <div className="my-contents">
                  <ContentList
                    title="최근 수정한 노트"
                    empty="작성한 노트가 없습니다."
                    items={data.myContents.recentNotes.map(n => ({ key: n.noteId, to: `/course/${n.courseId}/note/${n.noteId}`, title: n.title || '제목 없음', at: n.updatedAt }))}
                  />
                  <ContentList
                    title="최근 만든 퀴즈"
                    empty="만든 퀴즈가 없습니다."
                    items={data.myContents.recentQuizzes.map(q => ({ key: q.quizSetId, to: '/quizzes', title: q.title, at: q.createdAt }))}
                  />
                  <ContentList
                    title="공유한 노트"
                    empty="공유한 노트가 없습니다."
                    items={data.myContents.sharedNotes.map(n => ({ key: n.postId, to: `/shared-notes/${n.postId}`, title: n.title, at: n.createdAt }))}
                  />
                  <ContentList
                    title="공유한 시험"
                    empty="공유한 시험이 없습니다."
                    items={data.myContents.sharedQuizzes.map(q => ({ key: q.sharedQuizId, to: '/shared-quizzes', title: q.title, at: q.createdAt }))}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default MyPage;
