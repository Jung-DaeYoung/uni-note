import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import useGlobalSearch from '../../hooks/useGlobalSearch';
import SearchResultItem from './SearchResultItem';
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, TYPE_LABELS, resultLink } from './searchUtils';
import '../../pages/QuizLibraryPage.css';
import './GlobalSearch.css';

const ALL_RESULTS_OPTION = { isAll: true };

// AppLayout 헤더의 검색창. 포커스는 입력창에 두고 aria-activedescendant로 선택 항목을 알린다.
// 헤더가 좁으면 CSS가 입력창을 숨기고 아이콘 버튼을 보여 주며, expanded일 때 헤더 위에 입력창을 펼친다.
const GlobalSearch = () => {
  const navigate = useNavigate();
  const baseId = useId();
  const [value, setValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // 선택은 그때의 결과에만 유효하다. 새 결과가 오면 같은 번호가 다른 항목을 가리키므로 풀린다.
  const [selection, setSelection] = useState({ index: -1, groups: null });
  const inputRef = useRef(null);
  const toggleRef = useRef(null);
  const panelRef = useRef(null);
  const { groups, query: resultQuery, loading, error, retry } = useGlobalSearch(value);

  const query = value.trim();
  const isSearchable = query.length >= MIN_QUERY_LENGTH;
  const hasResults = isSearchable && groups.length > 0;
  const options = hasResults ? [...groups.flatMap(group => group.results), ALL_RESULTS_OPTION] : [];
  const active = selection.groups === groups ? selection.index : -1;
  const optionId = (index) => `${baseId}-option-${index}`;
  const listId = `${baseId}-list`;
  const showPanel = isOpen && query.length > 0;
  const isEmpty = isSearchable && !loading && !error && resultQuery === query && groups.length === 0;

  useEffect(() => {
    if (isExpanded) inputRef.current?.focus();
  }, [isExpanded]);

  useEffect(() => {
    panelRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const close = () => {
    setIsOpen(false);
    setIsExpanded(false);
    setSelection({ index: -1, groups: null });
  };

  const goToAllResults = () => {
    close();
    navigate(`/search?${new URLSearchParams({ q: query })}`);
  };

  const choose = (option) => {
    if (option.isAll) {
      goToAllResults();
      return;
    }
    const { to, state } = resultLink(option);
    close();
    navigate(to, state ? { state } : undefined);
  };

  const handleKeyDown = (e) => {
    // 한글 조합 중의 Enter·화살표는 글자를 확정하는 입력이다.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === 'Escape') {
      if (isExpanded) toggleRef.current?.focus();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (options.length === 0) return;
      e.preventDefault();
      setIsOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setSelection({ index: (Math.max(active, step > 0 ? -1 : 0) + step + options.length) % options.length, groups });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showPanel && active >= 0) choose(options[active]);
      else if (isSearchable) goToAllResults();
    }
  };

  const renderOption = (key, content, option, className = '') => {
    const index = options.indexOf(option);
    return (
      <div
        key={key}
        id={optionId(index)}
        role="option"
        aria-selected={index === active}
        onClick={() => choose(option)}
        className={`gs-option ${className}`}
      >
        {content}
      </div>
    );
  };

  return (
    <div
      className={`gs ${isExpanded ? 'gs-expanded' : ''}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        onClick={() => { setIsExpanded(true); setIsOpen(true); }}
        aria-label="검색 열기"
        title="검색"
        className="gs-toggle"
      >
        <Search size={18} />
      </button>

      <div className="gs-field">
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="통합 검색"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
          value={value}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="노트, 게시글, 문제 검색"
          autoComplete="off"
          onChange={(e) => { setValue(e.target.value); setIsOpen(true); setSelection({ index: -1, groups: null }); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="gs-input"
        />
      </div>

      {showPanel && (
        // 패널을 눌러도 입력창의 포커스를 유지한다.
        <div ref={panelRef} className="gs-panel custom-scrollbar" onMouseDown={(e) => e.preventDefault()}>
          {!isSearchable && <p className="gs-message">두 글자 이상 입력하세요.</p>}
          {loading && <p role="status" className="gs-message">찾는 중...</p>}
          {error && (
            <div role="alert" className="gs-message gs-error">
              <p>{error}</p>
              <button type="button" onClick={retry} className="lib-btn">다시 시도</button>
            </div>
          )}
          {isEmpty && (
            <p role="status" className="gs-message">
              검색 결과가 없습니다.<br />
              노트 제목, 본문, 게시글 또는 문제 키워드를 바꿔 검색해 보세요.
            </p>
          )}
          <div id={listId} role="listbox" aria-label="검색 결과">
            {groups.map(group => (
              <div key={group.type} role="group" aria-label={TYPE_LABELS[group.type]} className="gs-group">
                <div className="gs-group-label" aria-hidden="true">{TYPE_LABELS[group.type]}</div>
                {group.results.map(result => renderOption(
                  `${result.type}-${result.targetId}`,
                  <SearchResultItem result={result} query={resultQuery} />,
                  result,
                ))}
              </div>
            ))}
            {hasResults && renderOption('all', '전체 검색 결과 보기', ALL_RESULTS_OPTION, 'gs-all')}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
