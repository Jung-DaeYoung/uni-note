import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import client from '../../api/client';
import GlobalSearch from './GlobalSearch';

vi.mock('../../api/client', () => ({ default: { get: vi.fn() } }));

const noteResult = {
  type: 'NOTE', targetId: 12, blockId: 'b1', title: '<b>JWT</b> 노트', preview: 'JWT 토큰',
  courseId: 1, courseName: '운영체제', authorName: null, date: '2026-11-01T12:30:00',
};
const postResult = {
  type: 'COURSE_POST', targetId: 3, blockId: null, title: '질문', preview: null,
  courseId: 1, courseName: '운영체제', authorName: '익명 7', date: '2026-11-01T12:30:00',
};

const Where = () => {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}|{location.state?.sourceBlockId ?? ''}</output>;
};

const setup = () => {
  render(<MemoryRouter><GlobalSearch /><Where /></MemoryRouter>);
  return screen.getByRole('combobox', { name: '통합 검색' });
};

const type = (input, value) => {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
};

describe('GlobalSearch', () => {
  beforeEach(() => {
    client.get.mockReset();
    client.get.mockResolvedValue({
      data: { query: 'JWT', groups: [
        { type: 'NOTE', hasMore: false, results: [noteResult] },
        { type: 'COURSE_POST', hasMore: false, results: [postResult] },
      ] },
    });
  });

  it('한 글자는 요청하지 않고 안내한다', async () => {
    const input = setup();
    type(input, '가');

    expect(screen.getByText('두 글자 이상 입력하세요.')).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(client.get).not.toHaveBeenCalled();
  });

  it('연속 입력은 마지막 검색어만 요청하고 결과를 유형별로 보여 준다', async () => {
    const input = setup();
    type(input, 'JW');
    type(input, 'JWT');

    expect(await screen.findByRole('group', { name: '내 노트' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '강의 게시판' })).toBeInTheDocument();
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get.mock.calls[0][1].params).toEqual({ q: 'JWT', type: 'all' });
  });

  it('제목의 HTML을 해석하지 않고 검색어만 강조한다', async () => {
    const input = setup();
    type(input, 'JWT');

    const option = (await screen.findAllByRole('option'))[0];
    expect(option).toHaveTextContent('<b>JWT</b> 노트');
    expect(option.querySelector('b')).toBeNull();
    expect(option.querySelector('mark')).toHaveTextContent('JWT');
  });

  it('화살표와 Enter로 고른 노트의 블록으로 이동하고 패널을 닫는다', async () => {
    const input = setup();
    type(input, 'JWT');
    await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('where')).toHaveTextContent('/course/1/note/12|b1');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveValue('JWT');
  });

  it('위 화살표는 마지막 항목(전체 결과)부터 고른다', async () => {
    const input = setup();
    type(input, 'JWT');
    const options = await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input.getAttribute('aria-activedescendant')).toBe(options.at(-1).id);
    expect(options.at(-1)).toHaveTextContent('전체 검색 결과 보기');
  });

  it('고른 항목 없이 Enter를 누르면 검색 화면으로 간다', () => {
    const input = setup();
    type(input, '운영 체제');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('where')).toHaveTextContent('/search?q=%EC%9A%B4%EC%98%81+%EC%B2%B4%EC%A0%9C');
  });

  it('한글 조합 중의 Enter와 화살표는 처리하지 않는다', async () => {
    const input = setup();
    type(input, 'JWT');
    await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'ArrowDown', isComposing: true });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(screen.getByTestId('where')).toHaveTextContent('/|');
  });

  it('Escape는 패널을 닫고 입력값을 유지한다', async () => {
    const input = setup();
    type(input, 'JWT');
    await screen.findAllByRole('option');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveValue('JWT');
  });

  it('결과가 없으면 안내하고, 실패하면 다시 시도할 수 있다', async () => {
    client.get.mockResolvedValueOnce({ data: { query: 'JWT', groups: [] } });
    client.get.mockRejectedValueOnce({ response: { data: { message: '서버 오류' } } });
    const input = setup();
    type(input, 'JWT');
    expect(await screen.findByText(/검색 결과가 없습니다/)).toBeInTheDocument();

    type(input, 'JWT2');
    expect(await screen.findByRole('alert')).toHaveTextContent('서버 오류');

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.getAllByRole('group')).toHaveLength(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
