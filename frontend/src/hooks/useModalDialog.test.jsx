import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import useModalDialog from './useModalDialog';

const Dialog = ({ name, onClose, closeOnEscape }) => {
  const ref = useModalDialog(true, onClose, { closeOnEscape });
  return (
    <div ref={ref} role="dialog" aria-label={name} tabIndex={-1}>
      <button>{name} 첫째</button>
      <button>{name} 둘째</button>
    </div>
  );
};

describe('useModalDialog', () => {
  it('열리면 초점이 모달로 가고, Tab은 모달 안에서 돈다', () => {
    render(<Dialog name="A" onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toHaveFocus();

    screen.getByText('A 둘째').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByText('A 첫째')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('A 둘째')).toHaveFocus();
  });

  it('겹쳐 열리면 ESC는 맨 위 모달만 닫고, closeOnEscape=false면 닫지 않는다', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    const { rerender } = render(<><Dialog name="A" onClose={closeA} /><Dialog name="B" onClose={closeB} /></>);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();

    rerender(<Dialog name="A" onClose={closeA} closeOnEscape={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeA).not.toHaveBeenCalled();
  });

  it('닫히면 열기 전 초점으로 돌아간다', () => {
    const { rerender } = render(<button>열기</button>);
    screen.getByText('열기').focus();
    rerender(<><button>열기</button><Dialog name="A" onClose={() => {}} /></>);
    rerender(<button>열기</button>);
    expect(screen.getByText('열기')).toHaveFocus();
  });
});
