import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, CalendarDays, BookOpen, Clock, FolderOpen } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import ActivityHeatmap from '../components/mypage/ActivityHeatmap';
import client from '../api/client';

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

const formatDateTime = (value) => (value ? value.slice(0, 16).replace('T', ' ') : '-');

const SECTION_TITLE = 'text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800';
const CARD = 'bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700';
const EMPTY = 'text-xs text-slate-400 dark:text-slate-500';

const ContentList = ({ title, items, empty }) => (
  <div className={`${CARD} p-4`}>
    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{title}</p>
    {items.length === 0 ? (
      <p className={EMPTY}>{empty}</p>
    ) : (
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            <Link to={item.to} className="truncate text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400">{item.title}</Link>
            <span className="ml-auto shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(item.at)}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const MyPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/mypage')
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.message || '마이페이지 정보를 불러오지 못했습니다.');
      });
  }, []);

  const totalActivities = data ? data.heatmap.reduce((sum, d) => sum + d.count, 0) : 0;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8 font-sans">
        {error ? (
          <p className="py-12 text-center text-sm font-medium text-red-500">{error}</p>
        ) : !data ? (
          <p className="py-12 text-center text-sm font-medium text-slate-400 dark:text-slate-500">불러오는 중...</p>
        ) : (
          <>
            {/* 프로필 */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <User size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{data.profile.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{data.profile.studentNum}</p>
              </div>
            </div>

            {/* 활동 히트맵 (학기 범위) */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <CalendarDays size={16} className="text-blue-600 dark:text-blue-400" />
                {data.semester.label} 학습 활동
                <span className="ml-auto text-xs font-medium text-slate-400 dark:text-slate-500">
                  {data.semester.startDate} ~ {data.semester.endDate} · 총 {totalActivities}회
                </span>
              </h3>
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <ActivityHeatmap startDate={data.semester.startDate} endDate={data.semester.endDate} heatmap={data.heatmap} />
                {totalActivities === 0 && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">이번 학기 활동 기록이 아직 없습니다.</p>
                )}
              </div>
            </section>

            {/* 통계 카드 (전체 누적) */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-200 dark:border-slate-800">
                전체 학습 통계
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {SUMMARY_ITEMS.map(({ key, label }) => (
                  <div key={key} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{data.summary[key]}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 강의별 현황 */}
            <section className="space-y-4">
              <h3 className={SECTION_TITLE}>
                <BookOpen size={16} className="text-blue-600 dark:text-blue-400" />
                강의별 학습 현황
              </h3>
              {data.courseProgress.length === 0 ? (
                <p className={EMPTY}>수강 중인 강의가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.courseProgress.map(course => (
                    <Link key={course.courseId} to={`/course/${course.courseId}`} className={`${CARD} p-4 hover:border-blue-400 dark:hover:border-blue-500`}>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{course.courseName}</p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        노트 {course.noteCount} · 퀴즈 {course.quizSetCount} · 풀이 {course.attemptCount}
                      </p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        최근 활동 {course.lastActivityAt ? formatDateTime(course.lastActivityAt) : '없음'}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* 최근 활동 */}
            <section className="space-y-4">
              <h3 className={SECTION_TITLE}>
                <Clock size={16} className="text-blue-600 dark:text-blue-400" />
                최근 활동
              </h3>
              {data.recentActivities.length === 0 ? (
                <p className={EMPTY}>최근 활동이 없습니다.</p>
              ) : (
                <ul className={`${CARD} divide-y divide-slate-100 dark:divide-slate-800`}>
                  {data.recentActivities.map((activity, index) => {
                    const type = ACTIVITY_TYPES[activity.type];
                    return (
                      <li key={`${activity.type}-${activity.targetId}-${index}`}>
                        <Link to={type ? type.to(activity) : '/mypage'} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <span className="shrink-0 w-24 text-xs font-medium text-blue-600 dark:text-blue-400">{type?.label ?? activity.type}</span>
                          <span className="truncate text-slate-700 dark:text-slate-200">{activity.title || '(제목 없음)'}</span>
                          <span className="ml-auto shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(activity.occurredAt)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 내 콘텐츠 */}
            <section className="space-y-4">
              <h3 className={SECTION_TITLE}>
                <FolderOpen size={16} className="text-blue-600 dark:text-blue-400" />
                내 콘텐츠
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
    </AppLayout>
  );
};

export default MyPage;
