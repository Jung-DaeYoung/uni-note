import React from 'react';
import { highlightParts } from './searchUtils';
import './GlobalSearch.css';

const Highlighted = ({ text, query }) =>
  highlightParts(text, query).map((part, index) => (
    part.hit ? <mark key={index} className="sr-mark">{part.text}</mark> : <React.Fragment key={index}>{part.text}</React.Fragment>
  ));

// 헤더 패널과 검색 화면이 함께 쓰는 결과 한 줄의 내용. 클릭 처리는 감싸는 쪽이 맡는다.
const SearchResultItem = ({ result, query }) => (
  <>
    <span className="sr-title"><Highlighted text={result.title || '제목 없음'} query={query} /></span>
    {result.preview && <span className="sr-preview"><Highlighted text={result.preview} query={query} /></span>}
    <span className="sr-meta">
      <span>{result.courseName}</span>
      {result.authorName && <span>{result.authorName}</span>}
      {result.date && <span>{new Date(result.date).toLocaleDateString()}</span>}
    </span>
  </>
);

export default SearchResultItem;
