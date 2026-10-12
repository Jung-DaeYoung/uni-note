import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuggestionList from './SuggestionList';

// SlashCommand의 Tiptap Suggestion 플러그인은 이 컴포넌트의 onKeyDown(ref)을
// 직접 호출하는 방식으로 키보드 이벤트를 위임한다(문서 자체에는 keydown 리스너가 없다).
// 이 테스트는 그 실제 호출 계약을 그대로 재현해 PLANS.md가 보호하는 Slash Command
// 동작(ArrowUp/ArrowDown 선택, Enter 실행, 마우스 클릭 실행)을 회귀 검사한다.
const buildItems = () => [
  { title: '텍스트', command: vi.fn() },
  { title: '제목 1', command: vi.fn() },
  { title: '제목 2', command: vi.fn() },
];

describe('SuggestionList (Slash Command 메뉴)', () => {
  it('첫 아이템이 기본 선택 상태로 렌더링된다', () => {
    const items = buildItems();
    render(<SuggestionList items={items} command={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveClass('bg-blue-600');
    expect(buttons[1]).not.toHaveClass('bg-blue-600');
  });

  it('ArrowDown/ArrowUp이 선택 인덱스를 순환 이동시키고 true(처리됨)를 반환한다', () => {
    const items = buildItems();
    const ref = React.createRef();
    render(<SuggestionList ref={ref} items={items} command={vi.fn()} />);

    let handled;
    act(() => {
      handled = ref.current.onKeyDown({ event: { key: 'ArrowDown' } });
    });
    expect(handled).toBe(true);
    expect(screen.getAllByRole('button')[1]).toHaveClass('bg-blue-600');

    // 마지막에서 ArrowDown을 누르면 다시 처음으로 순환한다.
    act(() => {
      ref.current.onKeyDown({ event: { key: 'ArrowDown' } });
      handled = ref.current.onKeyDown({ event: { key: 'ArrowDown' } });
    });
    expect(handled).toBe(true);
    expect(screen.getAllByRole('button')[0]).toHaveClass('bg-blue-600');

    // 처음에서 ArrowUp을 누르면 마지막으로 순환한다.
    act(() => {
      handled = ref.current.onKeyDown({ event: { key: 'ArrowUp' } });
    });
    expect(handled).toBe(true);
    expect(screen.getAllByRole('button')[2]).toHaveClass('bg-blue-600');
  });

  it('Enter는 현재 선택된 아이템의 command를 실행하고 true를 반환한다', () => {
    const items = buildItems();
    const command = vi.fn();
    const ref = React.createRef();
    render(<SuggestionList ref={ref} items={items} command={command} />);

    // 실제 브라우저에서는 ArrowDown과 Enter가 별개의 keydown 이벤트로 각각
    // 렌더링을 거친 뒤 도착하므로, 두 호출 사이에 act()를 분리해 재렌더를 반영한다.
    act(() => {
      ref.current.onKeyDown({ event: { key: 'ArrowDown' } }); // 두 번째 항목 선택
    });

    let handled;
    act(() => {
      handled = ref.current.onKeyDown({ event: { key: 'Enter' } });
    });

    expect(handled).toBe(true);
    expect(command).toHaveBeenCalledWith(items[1]);
  });

  it('관련 없는 키는 처리하지 않고 false를 반환한다(일반 입력이 그대로 통과해야 함)', () => {
    const items = buildItems();
    const ref = React.createRef();
    render(<SuggestionList ref={ref} items={items} command={vi.fn()} />);

    expect(ref.current.onKeyDown({ event: { key: 'a' } })).toBe(false);
  });

  it('마우스 클릭(mousedown)으로 항목을 선택하면 해당 아이템의 command가 실행된다', async () => {
    const items = buildItems();
    const command = vi.fn();
    const user = userEvent.setup();
    render(<SuggestionList items={items} command={command} />);

    await user.click(screen.getAllByRole('button')[2]);

    expect(command).toHaveBeenCalledWith(items[2]);
  });

  it('items가 비어 있으면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<SuggestionList items={[]} command={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
