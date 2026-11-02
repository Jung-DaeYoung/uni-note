import { describe, expect, it } from 'vitest';
import { highlightParts, resultLink } from './searchUtils';

describe('highlightParts', () => {
  it('대소문자 없이 일치한 부분을 모두 나눈다', () => {
    expect(highlightParts('JWT와 jwt 토큰', 'jwt')).toEqual([
      { text: 'JWT', hit: true },
      { text: '와 ', hit: false },
      { text: 'jwt', hit: true },
      { text: ' 토큰', hit: false },
    ]);
  });

  it('정규식 문자를 글자 그대로 찾고 비어 있는 값을 처리한다', () => {
    expect(highlightParts('진도 100% (a.b)', '(a.b)').at(-1)).toEqual({ text: '(a.b)', hit: true });
    expect(highlightParts(null, 'a')).toEqual([]);
    expect(highlightParts('글', ' ')).toEqual([{ text: '글', hit: false }]);
  });
});

describe('resultLink', () => {
  it('노트는 블록이 있을 때만 state로 넘긴다', () => {
    const note = { type: 'NOTE', courseId: 1, targetId: 12, blockId: 'b' };
    expect(resultLink(note)).toEqual({ to: '/course/1/note/12', state: { sourceBlockId: 'b' } });
    expect(resultLink({ ...note, blockId: null })).toEqual({ to: '/course/1/note/12', state: undefined });
  });

  it('게시글과 공유 콘텐츠는 기존 화면으로 연결한다', () => {
    expect(resultLink({ type: 'COURSE_POST', courseId: 1, targetId: 3 }).to).toBe('/course/1?postId=3');
    expect(resultLink({ type: 'SHARED_NOTE', courseId: 1, targetId: 4 }).to).toBe('/shared-notes/4');
    expect(resultLink({ type: 'SHARED_QUIZ', courseId: 1, targetId: 5 }).to).toBe('/shared-quizzes?sharedQuizId=5');
  });
});
