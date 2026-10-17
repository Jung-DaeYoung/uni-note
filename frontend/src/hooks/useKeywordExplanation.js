import { useEffect, useState } from 'react';
import client from '../api/client';

// 세션 캐시: 같은 노트·블록·키워드·문맥이면 진행 중이거나 끝난 요청을 다시 쓴다. 실패한 요청은 지운다.
// ponytail: 새로고침하면 비워지고 크기 제한이 없다. 사용량이 늘면 서버 캐시(PLANS.md §9)로 옮긴다.
const cache = new Map();

export const clearKeywordCache = () => cache.clear();

const keyOf = (target) =>
  [target.noteId, target.blockId ?? '', target.keyword.trim().toLowerCase(), target.context ?? ''].join('|');

const useKeywordExplanation = (target) => {
  const [state, setState] = useState({ data: null, loading: false, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!target) return undefined;
    let cancelled = false;
    const key = keyOf(target);
    if (!cache.has(key)) {
      const request = client.post('/keywords/explain', {
        keyword: target.keyword,
        context: target.context || null,
        courseId: target.courseId,
        noteId: target.noteId,
        blockId: target.blockId,
      }).then(res => res.data);
      request.catch(() => cache.delete(key));
      cache.set(key, request);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ data: null, loading: true, error: null });
    cache.get(key).then(
      data => { if (!cancelled) setState({ data, loading: false, error: null }); },
      error => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error.response?.data?.message || '키워드 설명을 불러오지 못했습니다.' });
        }
      },
    );
    return () => { cancelled = true; };
  }, [target, attempt]);

  return { ...state, retry: () => setAttempt(n => n + 1) };
};

export default useKeywordExplanation;
