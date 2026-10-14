import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActivityHeatmap, { buildWeeks, levelOf } from './ActivityHeatmap';

describe('ActivityHeatmap', () => {
  it('색 단계는 0 / 1–2 / 3–5 / 6–9 / 10 이상 구간을 따른다', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10, 30].map(levelOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('학기 시작 주의 일요일부터 종료일까지 채우고 학기 밖 칸은 비운다', () => {
    // 2026-09-01은 화요일, 2026-12-31은 목요일
    const weeks = buildWeeks('2026-09-01', '2026-12-31', []);
    expect(weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(weeks[0][2]).toEqual({ date: '2026-09-01', count: 0 });
    expect(weeks.at(-1)[4]).toEqual({ date: '2026-12-31', count: 0 });
    expect(weeks.at(-1)[5]).toBeNull();
    expect(weeks.flat().filter(Boolean)).toHaveLength(122);
  });

  it('활동이 있는 날은 횟수와 색 단계를 표시한다', () => {
    render(
      <ActivityHeatmap
        startDate="2026-09-01"
        endDate="2026-12-31"
        heatmap={[{ date: '2026-09-03', count: 4 }]}
      />
    );

    const cell = screen.getByLabelText('2026-09-03 활동 4회');
    expect(cell.dataset.level).toBe('2');
    expect(screen.getByLabelText('2026-09-04 활동 0회').dataset.level).toBe('0');
  });
});
