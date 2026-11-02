import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import client from '../api/client';
import LoginPage from './LoginPage';

vi.mock('../api/client', () => ({ default: { post: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));

describe('LoginPage', () => {
  it('로그인 실패 시 오류를 폼 안에 표시하고 학번 입력창으로 포커스를 옮긴다', async () => {
    client.post.mockRejectedValue({ response: { data: { message: '학번 또는 비밀번호가 틀렸습니다.' } } });
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    // getByLabelText는 label과 input이 실제로 연결되어 있어야 통과한다.
    const studentNum = screen.getByLabelText('학번');
    const password = screen.getByLabelText('비밀번호');
    expect(studentNum).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('autocomplete', 'current-password');

    await user.type(studentNum, '2021001');
    await user.type(password, 'wrong');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('학번 또는 비밀번호가 틀렸습니다.');
    expect(studentNum).toHaveFocus();
    expect(studentNum).toHaveAttribute('aria-invalid', 'true');
    expect(studentNum).toHaveAttribute('aria-describedby', 'login-error');
  });
});
