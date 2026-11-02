import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import client from '../api/client';
import AppLayout from '../components/layout/AppLayout';
import SearchResultItem from '../components/search/SearchResultItem';
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, TYPE_FILTERS, TYPE_LABELS, resultLink } from '../components/search/searchUtils';
import { useCourses } from '../context/CourseContext';
import './QuizLibraryPage.css';
import './SharedBoard.css';
import './SearchPage.css';

const PAGE_SIZE = 20;
const FILTER_TABS = [
  { key: 'all', label: '전체' },
  ...Object.entries(TYPE_FILTERS).map(([type, key]) => ({ key, label: TYPE_LABELS[type] })),
];

// 검색어·유형·강의가 바뀌면 부모가 key로 새로 마운트해 페이지를 초기화한다.
const SearchResults = ({ query, type, courseId, onChooseType }) => {
  const [page, setPage] = useState(0);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);
    client.get('/search', {
      params: { q: query, type, courseId: courseId || undefined, page, size: PAGE_SIZE },
      signal: controller.signal,
    }).then((res) => {
      const next = res.data.groups;
      // 다음 페이지는 한 유형의 결과만 오므로 기존 목록 뒤에 붙인다.
      setGroups(prev => (page === 0 ? next : prev.map(group => ({
        ...group,
        hasMore: next[0]?.hasMore ?? false,
        results: [...group.results, ...(next[0]?.results ?? [])],
      }))));
      setIsLoading(false);
    }).catch((err) => {
      if (axios.isCancel(err)) return;
      setError(err.response?.data?.message || '검색하지 못했습니다.');
      setIsLoading(false);
    });
    return () => controller.abort();
  }, [query, type, courseId, page, retryCount]);

  return (
    <>
      {groups.map(group => (
        <section key={group.type} className="lib-group">
          <h2 className="lib-heading">{TYPE_LABELS[group.type]}</h2>
          <ul className="lib-list">
            {group.results.map((result) => {
              const { to, state } = resultLink(result);
              return (
                <li key={`${result.type}-${result.targetId}`}>
                  <Link to={to} state={state} className="sp-row">
                    <SearchResultItem result={result} query={query} />
                  </Link>
                </li>
              );
            })}
          </ul>
          {group.hasMore && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => (type === 'all' ? onChooseType(TYPE_FILTERS[group.type]) : setPage(page + 1))}
              className="lib-btn sp-more"
            >
              {TYPE_LABELS[group.type]} 더 보기
            </button>
          )}
        </section>
      ))}

      {isLoading && <p role="status" className="sp-message">찾는 중...</p>}
      {error && (
        <div role="alert" className="sp-message sp-error">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryCount(count => count + 1)} className="lib-btn sp-more">다시 시도</button>
        </div>
      )}
      {!isLoading && !error && groups.length === 0 && (
        <p role="status" className="sp-message">
          검색 결과가 없습니다.<br />
          노트 제목, 본문, 게시글 또는 문제 키워드를 바꿔 검색해 보세요.
        </p>
      )}
    </>
  );
};

const SearchPage = () => {
  const { courses } = useCourses();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const rawType = searchParams.get('type');
  const type = FILTER_TABS.some(tab => tab.key === rawType) ? rawType : 'all';
  const courseId = searchParams.get('courseId') || '';

  const update = (changes) => {
    const next = { q: query, type, courseId, ...changes };
    setSearchParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)));
  };

  return (
    <AppLayout>
      <div className="lib-frame">
        <div className="lib">
          <h1 className="lib-title">통합 검색</h1>

          {/* key: 다른 경로로 검색어가 바뀌어도 입력창을 URL에 맞춘다. */}
          <form
            key={query}
            role="search"
            className="sp-form"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: new FormData(e.currentTarget).get('q').trim() });
            }}
          >
            <input
              type="search"
              name="q"
              defaultValue={query}
              maxLength={MAX_QUERY_LENGTH}
              aria-label="검색어"
              placeholder="노트, 게시글, 문제 검색"
              className="sp-input"
            />
            <button type="submit" className="lib-btn lib-btn-primary sp-more">검색</button>
          </form>

          <div className="lib-tabs board-bar sp-tabs">
            <div className="board-sorts">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => update({ type: tab.key })}
                  aria-pressed={type === tab.key}
                  className="lib-tab"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={courseId}
              onChange={(e) => update({ courseId: e.target.value })}
              aria-label="강의 필터"
              className="lib-select"
            >
              <option value="">전체 강의</option>
              {courses.map(course => (
                <option key={course.courseId} value={course.courseId}>{course.courseName}</option>
              ))}
            </select>
          </div>

          {query.length >= MIN_QUERY_LENGTH ? (
            <SearchResults
              key={`${query}|${type}|${courseId}`}
              query={query}
              type={type}
              courseId={courseId}
              onChooseType={(nextType) => update({ type: nextType })}
            />
          ) : (
            <p className="sp-message">검색어를 두 글자 이상 입력하세요.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default SearchPage;
