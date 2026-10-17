import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeakAreaBreakdown from './WeakAreaBreakdown';

const concept = (conceptTag, courseId, accuracyRate) => ({
  conceptTag, courseId, courseName: '운영체제', questionCount: 1,
  attemptCount: 4, correctCount: 1, incorrectCount: 3, accuracyRate, reviewPriority: 'HIGH',
});

describe('WeakAreaBreakdown 취약 개념', () => {
  it('개념 통계가 없으면 안내 문구를 보여준다', () => {
    render(<WeakAreaBreakdown courseStats={[]} typeStats={[]} conceptStats={[]} isLoading={false} />);
    expect(screen.getByText('개념 태그가 있는 문제를 풀면 표시됩니다.')).toBeInTheDocument();
  });

  it('서버 정렬 순서대로 최대 8개 개념을 정답률·풀이 수와 함께 보여준다', () => {
    const stats = Array.from({ length: 9 }, (_, i) => concept(`개념${i}`, 1, 0.25));
    render(<WeakAreaBreakdown courseStats={[]} typeStats={[]} conceptStats={stats} isLoading={false} />);

    expect(screen.getByText('개념0')).toBeInTheDocument();
    expect(screen.getByText('개념7')).toBeInTheDocument();
    expect(screen.queryByText('개념8')).not.toBeInTheDocument();
    expect(screen.getAllByText('25% · 4회')).toHaveLength(8);
  });
});
