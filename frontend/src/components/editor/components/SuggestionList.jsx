import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import '../../../pages/QuizLibraryPage.css';
import './SuggestionList.css';

const SuggestionList = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { items } = props;

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = (index) => {
    const item = items[index];
    if (item) {
      props.command(item);
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  // 선택된 아이템이 화면 밖으로 나갈 경우 자동 스크롤
  useEffect(() => {
    const listElement = document.getElementById('suggestion-list-container');
    const selectedElement = listElement?.children[selectedIndex];
    
    if (listElement && selectedElement) {
      const listRect = listElement.getBoundingClientRect();
      const itemRect = selectedElement.getBoundingClientRect();

      // Element.scrollIntoView()는 behavior(smooth/auto)와 무관하게 브라우저 네이티브
      // selection을 건드려, ProseMirror가 이를 pointer 트랜잭션으로 오인해 Suggestion이
      // onExit되는 원인이었다(Enter가 SlashCommand에 도달하지 못하고 줄바꿈이 됨).
      // scrollIntoView 대신 컨테이너의 scrollTop을 직접 계산해 옮기면 이 부수효과가 없다.
      if (itemRect.bottom > listRect.bottom) {
        listElement.scrollTop += itemRect.bottom - listRect.bottom;
      } else if (itemRect.top < listRect.top) {
        listElement.scrollTop -= listRect.top - itemRect.top;
      }
    }
  }, [selectedIndex]);

  if (items.length === 0) return null;

  return (
    <div
      className="slash"
      // 메뉴 내부(버튼 사이 여백, 헤더 등)에서 마우스가 상호작용해도 기본 동작으로
      // 에디터의 포커스/ProseMirror selection이 옮겨가지 않도록 최상위에서 차단한다.
      // 버튼 자체의 onMouseDown(선택 처리)은 그대로 동작하며 이 핸들러와 중복 실행되지 않는다.
      // 주의: onPointerDown에서 preventDefault를 호출하면 브라우저가 뒤이은 호환용
      // mousedown/click 이벤트 자체를 발생시키지 않아(Pointer Events 스펙) 버튼의
      // onMouseDown이 실행되지 않는 회귀가 있었다. 그래서 onPointerDown은 쓰지 않는다.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="slash-head">
        <span>명령어</span>
        <span>{items.length}개</span>
      </div>
      <div id="suggestion-list-container" className="slash-list custom-scrollbar">
        {items.map((item, index) => (
          <button
            key={index}
            onMouseDown={(e) => {
              // 에디터 포커스 유지를 위해 기본 동작(포커스 뺏기) 방지
              e.preventDefault();
              selectItem(index);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`slash-item ${index === selectedIndex ? 'slash-item-selected bg-blue-600' : ''}`}
          >
            <span className="slash-icon">{item.icon}</span>
            <span className="slash-text">
              <span className="slash-title">{item.title}</span>
              {item.description && <span className="slash-desc">{item.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});

export default SuggestionList;
