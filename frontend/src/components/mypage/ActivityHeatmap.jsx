import React from 'react';

// 색 단계: 0 / 1–2 / 3–5 / 6–9 / 10 이상
const LEVEL_CLASSES = ['my-heat-0', 'my-heat-1', 'my-heat-2', 'my-heat-3', 'my-heat-4'];

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
      <div className="my-heat-scroll">
        <div className="my-heat-grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="my-heat-week">
              {week.map((day, di) => day ? (
                <div
                  key={day.date}
                  role="img"
                  title={`${day.date} 활동 ${day.count}회`}
                  aria-label={`${day.date} 활동 ${day.count}회`}
                  data-level={levelOf(day.count)}
                  className={`my-heat-cell ${LEVEL_CLASSES[levelOf(day.count)]}`}
                />
              ) : (
                <div key={`empty-${wi}-${di}`} className="my-heat-cell" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="my-heat-legend">
        <span>적음</span>
        {LEVEL_CLASSES.map((cls, i) => <div key={i} className={`my-heat-cell ${cls}`} />)}
        <span>많음</span>
      </div>
    </div>
  );
};

export default ActivityHeatmap;
