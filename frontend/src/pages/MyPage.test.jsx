import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyPage from './MyPage';
import client from '../api/client';

vi.mock('../api/client', () => ({ default: { get: vi.fn() } }));
vi.mock('../components/layout/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const baseData = {
  profile: { name: '홍길동', studentNum: '2021001' },
  semester: { label: '2026년 2학기', startDate: '2026-09-01', endDate: '2026-12-31' },
  summary: { noteCount: 0, quizSetCount: 0, attemptCount: 0, incorrectNoteCount: 0, postCount: 0, commentCount: 0, sharedCount: 0 },
  heatmap: [],
  courseProgress: [],
  recentActivities: [],
  myContents: { recentNotes: [], sharedNotes: [], sharedQuizzes: [] },
};

const renderPage = (data) => {
  client.get.mockResolvedValue({ data: { ...baseData, ...data } });
  return render(<MemoryRouter><MyPage /></MemoryRouter>);
};

describe('MyPage 2차 영역', () => {
  it('데이터가 없으면 각 영역에 빈 상태를 보여준다', async () => {
    renderPage({});
    expect(await screen.findByText('수강 중인 강의가 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('최근 활동이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('공유한 시험이 없습니다.')).toBeInTheDocument();
  });

  it('강의·활동·내 콘텐츠를 기존 라우트로 연결한다', async () => {
    renderPage({
      courseProgress: [{ courseId: 1, courseName: '운영체제', noteCount: 2, quizSetCount: 0, attemptCount: 1, lastActivityAt: null }],
      recentActivities: [
        { type: 'NOTE_UPDATED', title: '스케줄링', occurredAt: '2026-10-13T21:00:00', courseId: 1, targetId: 10 },
        { type: 'COMMENT_CREATED', title: '질문 글', occurredAt: '2026-10-12T10:00:00', courseId: 1, targetId: 24 },
        { type: 'QUIZ_SHARED', title: '중간고사 대비', occurredAt: '2026-10-12T09:00:00', courseId: 1, targetId: 5 },
      ],
      myContents: {
        recentNotes: [],
        sharedNotes: [{ postId: 3, title: '공유 노트', createdAt: '2026-10-11T09:00:00' }],
        sharedQuizzes: [],
      },
    });

    expect((await screen.findByText('운영체제')).closest('a')).toHaveAttribute('href', '/course/1');
    expect(screen.getByText('최근 활동 없음')).toBeInTheDocument();
    expect(screen.getByText('스케줄링').closest('a')).toHaveAttribute('href', '/course/1/note/10');
    expect(screen.getByText('질문 글').closest('a')).toHaveAttribute('href', '/course/1?postId=24');
    expect(screen.getByText('중간고사 대비').closest('a')).toHaveAttribute('href', '/shared-quizzes');
    expect(screen.getByText('공유 노트').closest('a')).toHaveAttribute('href', '/shared-notes/3');
  });
});
