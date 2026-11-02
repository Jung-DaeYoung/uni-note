export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;

export const TYPE_LABELS = {
  NOTE: '내 노트',
  COURSE_POST: '강의 게시판',
  SHARED_NOTE: '노트 공유',
  SHARED_QUIZ: '문제 공유',
};

// 결과 유형(응답)과 검색 요청의 type 값.
export const TYPE_FILTERS = {
  NOTE: 'note',
  COURSE_POST: 'post',
  SHARED_NOTE: 'shared_note',
  SHARED_QUIZ: 'shared_quiz',
};

// react-router의 to와 state. 노트 블록 이동은 useSourceBlockScroll이 state.sourceBlockId로 처리한다.
export const resultLink = (result) => {
  switch (result.type) {
    case 'NOTE':
      return {
        to: `/course/${result.courseId}/note/${result.targetId}`,
        state: result.blockId ? { sourceBlockId: result.blockId } : undefined,
      };
    case 'COURSE_POST':
      return { to: `/course/${result.courseId}?postId=${result.targetId}` };
    case 'SHARED_NOTE':
      return { to: `/shared-notes/${result.targetId}` };
    default:
      return { to: `/shared-quizzes?sharedQuizId=${result.targetId}` };
  }
};

// 검색어와 일치한 부분을 나눈다. 대소문자는 구분하지 않고, HTML로 해석하지 않도록 문자열 조각으로만 돌려준다.
export const highlightParts = (text, query) => {
  const source = text ?? '';
  const needle = (query ?? '').trim().toLowerCase();
  if (!needle) return [{ text: source, hit: false }];

  const lower = source.toLowerCase();
  const parts = [];
  let cursor = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    if (index > cursor) parts.push({ text: source.slice(cursor, index), hit: false });
    parts.push({ text: source.slice(index, index + needle.length), hit: true });
    cursor = index + needle.length;
    index = lower.indexOf(needle, cursor);
  }
  if (cursor < source.length) parts.push({ text: source.slice(cursor), hit: false });
  return parts;
};
