import { useEffect, useState } from 'react';
import client from '../api/client';

// 같은 강의의 내 노트에서 키워드가 나온 블록 목록. AI를 쓰지 않는 서버 검색이라 캐시하지 않는다.
const useKeywordMentions = (target) => {
  const [state, setState] = useState({ mentions: [], loading: false, error: null });

  useEffect(() => {
    if (!target) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ mentions: [], loading: true, error: null });
    client.get('/keywords/mentions', { params: { keyword: target.keyword, courseId: target.courseId } })
      .then(res => { if (!cancelled) setState({ mentions: res.data || [], loading: false, error: null }); })
      .catch(error => {
        if (!cancelled) {
          setState({ mentions: [], loading: false, error: error.response?.data?.message || '노트 언급을 불러오지 못했습니다.' });
        }
      });
    return () => { cancelled = true; };
  }, [target]);

  return state;
};

export default useKeywordMentions;
