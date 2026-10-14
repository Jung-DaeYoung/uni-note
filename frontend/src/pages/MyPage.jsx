import React, { useEffect, useState } from 'react';
import { User, CalendarDays } from 'lucide-react';
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
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default MyPage;
