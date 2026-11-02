import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import client from '../api/client';
import { MIN_QUERY_LENGTH } from '../components/search/searchUtils';

const DEBOUNCE_MS = 250;
const EMPTY = { groups: [], query: '', loading: false, error: null };

// 헤더 검색의 debounce·이전 요청 취소·상태. 새 결과가 오기 전까지 이전 결과를 유지해 패널이 깜빡이지 않게 한다.
const useGlobalSearch = (rawQuery) => {
  const query = rawQuery.trim();
  const [state, setState] = useState(EMPTY);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(EMPTY);
      return undefined;
    }
    setState(prev => ({ ...prev, loading: true, error: null }));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await client.get('/search', { params: { q: query, type: 'all' }, signal: controller.signal });
        setState({ groups: res.data.groups, query, loading: false, error: null });
      } catch (error) {
        if (axios.isCancel(error)) return;
        setState({ groups: [], query, loading: false, error: error.response?.data?.message || '검색하지 못했습니다.' });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, retryCount]);

  const retry = useCallback(() => setRetryCount(count => count + 1), []);

  return { ...state, retry };
};

export default useGlobalSearch;
