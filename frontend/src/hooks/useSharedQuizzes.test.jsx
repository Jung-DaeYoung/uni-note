import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import client from '../api/client';
import { showAlert } from '../context/ConfirmContext';
import useSharedQuizzes from './useSharedQuizzes';

vi.mock('../api/client', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../context/ConfirmContext', () => ({ showAlert: vi.fn(), useConfirm: () => vi.fn() }));

const render = (url) => renderHook(() => ({ hook: useSharedQuizzes(), location: useLocation() }), {
  wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
});

describe('useSharedQuizzes 검색 결과 딥링크', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockImplementation(async (url) => (
      url === '/shared-quizzes'
        ? { data: [{ sharedQuizId: 5, courseId: 1, viewCount: 0 }] }
        : { data: { quizSetId: 9, title: '시험', questions: [] } }
    ));
  });

  it('sharedQuizId로 시험을 한 번만 열고 파라미터를 지운다', async () => {
    const { result } = render('/shared-quizzes?sharedQuizId=5');

    await waitFor(() => expect(result.current.hook.selectedQuiz?.sharedQuizId).toBe(5));
    await waitFor(() => expect(result.current.hook.isLoading).toBe(false));

    expect(result.current.location.search).toBe('');
    expect(client.get.mock.calls.filter(([url]) => url === '/shared-quizzes/5')).toHaveLength(1);
  });

  it('없는 시험이면 알리고 목록을 유지한다', async () => {
    const { result } = render('/shared-quizzes?sharedQuizId=404');

    await waitFor(() => expect(showAlert).toHaveBeenCalled());
    expect(result.current.hook.selectedQuiz).toBeNull();
    expect(result.current.location.search).toBe('');
    await waitFor(() => expect(result.current.hook.posts).toHaveLength(1));
  });

  it('파라미터가 없으면 시험을 열지 않는다', async () => {
    const { result } = render('/shared-quizzes');

    await waitFor(() => expect(result.current.hook.posts).toHaveLength(1));
    expect(result.current.hook.selectedQuiz).toBeNull();
    expect(client.get).toHaveBeenCalledTimes(1);
  });
});
