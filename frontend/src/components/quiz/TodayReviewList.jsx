import React from 'react';
import { CalendarCheck, ExternalLink, PlayCircle } from 'lucide-react';

// 간격 반복 일정 표시. nextReviewAt(YYYY-MM-DD)이 오늘보다 이전이면 밀린 일수를 보여 준다.
const scheduleLabel = (item) => {
  if (!item.nextReviewAt) return null;
  const [y, m, d] = item.nextReviewAt.split('-').map(Number);
  const today = new Date();
  const overdueDays = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(y, m - 1, d)) / 86400000
  );
  return overdueDays > 0 ? `${overdueDays}일 밀림` : '오늘 복습';
};

const TodayReviewList = ({
  items,
  isLoading,
  courseOptions,
  courseFilter,
  onCourseFilterChange,
  onViewSource,
  onPracticeOne,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CalendarCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
          오늘의 복습
        </h3>
        {courseOptions.length > 0 && (
          <select
            value={courseFilter ?? ''}
            onChange={(e) => onCourseFilterChange(e.target.value ? Number(e.target.value) : null)}
            className="border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-md text-xs font-medium p-1.5"
          >
            <option value="">전체 강의</option>
            {courseOptions.map((c) => (
              <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">복습 목록을 불러오는 중...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <CalendarCheck size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
          <p className="font-medium text-slate-400 dark:text-slate-500 text-sm">오늘 복습할 문제를 모두 끝냈어요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.question.questionId}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {item.courseName && (
                    <span className="text-[11px] font-medium px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md shrink-0">
                      {item.courseName}
                    </span>
                  )}
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0 ${
                      item.incorrectCount >= 2
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.incorrectCount >= 2 ? `반복 오답 ${item.incorrectCount}회` : `오답 ${item.incorrectCount}회`}
                  </span>
                  {scheduleLabel(item) && (
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                      {scheduleLabel(item)}
                      {item.streak > 0 && ` · 연속 정답 ${item.streak}회`}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                  {item.question.questionText}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* 공유게시판 문제처럼 출처가 없는 문제는 원문 보기를 숨긴다(CBTPlayer와 동일). */}
                {item.question.sourceBlockId && (
                  <button
                    onClick={() => onViewSource(item)}
                    className="p-2 rounded-md text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    title="원문 보기"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
                <button
                  onClick={() => onPracticeOne(item)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-slate-900 dark:bg-slate-700 text-white hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors"
                >
                  <PlayCircle size={12} />
                  다시 풀기
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TodayReviewList;
