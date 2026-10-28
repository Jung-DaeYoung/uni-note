import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfirmProvider, showAlert, useConfirm } from './ConfirmContext';

let promise;
const Opener = () => {
  const confirm = useConfirm();
  return (
    <button onClick={() => { promise = confirm({ title: '노트를 삭제할까요?', message: '되돌릴 수 없습니다.', confirmLabel: '노트 삭제' }); }}>
      열기
    </button>
  );
};

const open = () => {
  const { unmount } = render(<ConfirmProvider><Opener /></ConfirmProvider>);
  act(() => { fireEvent.click(screen.getByText('열기')); });
  return { promise, unmount };
};

describe('ConfirmProvider', () => {
  it('확인 버튼은 true를 반환하고 모달을 닫는다', async () => {
    const { promise } = open();
    expect(screen.getByRole('dialog', { name: '노트를 삭제할까요?' })).toBeTruthy();
    fireEvent.click(screen.getByText('노트 삭제'));
    await expect(promise).resolves.toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('취소·닫기·ESC는 false를 반환한다', async () => {
    for (const cancel of [
      () => fireEvent.click(screen.getByText('취소')),
      () => fireEvent.click(screen.getByLabelText('닫기')),
      () => fireEvent.keyDown(document, { key: 'Escape' }),
    ]) {
      const { promise, unmount } = open();
      cancel();
      await expect(promise).resolves.toBe(false);
      expect(screen.queryByRole('dialog')).toBeNull();
      unmount();
    }
  });

  it('danger는 취소 버튼에 포커스를 둔다', () => {
    open();
    expect(document.activeElement.textContent).toBe('취소');
  });

  it('showAlert는 확인 버튼만 있는 알림 창을 띄운다', async () => {
    render(<ConfirmProvider><div /></ConfirmProvider>);
    let done;
    act(() => { done = showAlert('저장하지 못했습니다.'); });
    expect(screen.getByRole('dialog', { name: '저장하지 못했습니다.' })).toBeTruthy();
    expect(screen.queryByText('취소')).toBeNull();
    fireEvent.click(screen.getByText('확인'));
    await done;
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('input을 주면 입력값을 반환하고, 취소하면 null을 반환한다', async () => {
    const Renamer = () => {
      const confirm = useConfirm();
      return <button onClick={() => { promise = confirm({ title: '이름 변경', input: { defaultValue: '기존' } }); }}>열기</button>;
    };
    const { unmount } = render(<ConfirmProvider><Renamer /></ConfirmProvider>);
    act(() => { fireEvent.click(screen.getByText('열기')); });
    const input = screen.getByRole('textbox', { name: '이름 변경' });
    expect(input.value).toBe('기존');
    fireEvent.change(input, { target: { value: '새 이름' } });
    fireEvent.submit(input.form);
    await expect(promise).resolves.toBe('새 이름');

    act(() => { fireEvent.click(screen.getByText('열기')); });
    fireEvent.keyDown(document, { key: 'Escape' });
    await expect(promise).resolves.toBeNull();
    unmount();
  });
});
