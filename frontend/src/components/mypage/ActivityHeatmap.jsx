import React from 'react';

// 색 단계: 0 / 1–2 / 3–5 / 6–9 / 10 이상
const LEVEL_CLASSES = [
  'bg-slate-100 dark:bg-slate-800',
  'bg-blue-200 dark:bg-blue-900',
  'bg-blue-400 dark:bg-blue-700',
  'bg-blue-600 dark:bg-blue-500',
  'bg-blue-800 dark:bg-blue-300',
];

// eslint-disable-next-line react-refresh/only-export-components
export const levelOf = (count) => {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
};

// 'YYYY-MM-DD'를 시간대 영향 없이 로컬 날짜로 다룬다(new Date('YYYY-MM-DD')는 UTC로 해석된다).
const parseDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// 학기 시작 주의 일요일부터 종료일까지 주(열) 단위로 채운다. 학기 밖 칸은 null.
// eslint-disable-next-line react-refresh/only-export-components
export const buildWeeks = (startDate, endDate, heatmap) => {
  const counts = new Map(heatmap.map(d => [d.date, d.count]));
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  const weeks = [];
  while (cursor <= end) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = formatDate(cursor);
      week.push(cursor < start || cursor > end ? null : { date, count: counts.get(date) || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
};

const ActivityHeatmap = ({ startDate, endDate, heatmap }) => {
  const weeks = buildWeeks(startDate, endDate, heatmap);

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-1 w-max">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => day ? (
                <div
                  key={day.date}
                  title={`${day.date} · 활동 ${day.count}회`}
                  aria-label={`${day.date} 활동 ${day.count}회`}
                  data-level={levelOf(day.count)}
                  className={`w-3 h-3 rounded-sm ${LEVEL_CLASSES[levelOf(day.count)]}`}
                />
              ) : (
                <div key={`empty-${wi}-${di}`} className="w-3 h-3" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        <span className="mr-1">적음</span>
        {LEVEL_CLASSES.map((cls, i) => <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />)}
        <span className="ml-1">많음</span>
      </div>
    </div>
  );
};

export default ActivityHeatmap;
