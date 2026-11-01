import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import useKeywordExplanation from '../../../hooks/useKeywordExplanation';
import useKeywordMentions from '../../../hooks/useKeywordMentions';
import '../../../pages/QuizLibraryPage.css';
import './KeywordExplainPanel.css';

const TABS = [
  { key: 'summary', label: '3줄 요약' },
  { key: 'easyExplanation', label: '쉬운 설명' },
  { key: 'advancedExplanation', label: '전공 심화' },
];

// 마침표·물음표·느낌표 뒤 공백이나 줄바꿈에서 나눈다. 3.14처럼 뒤에 공백이 없는 점은 나누지 않는다.
const toSentenceLines = (text) =>
  text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);

// 오른쪽 고정 패널(CourseBoardPanel과 같은 자리). 키워드가 바뀌면 부모가 key로 새로 마운트해 탭을 초기화한다.
// canInsert: 설명을 만든 노트를 지금 편집 중인지. onInsert({ text, label })는 사용자 확인 후 적용 여부를 돌려준다(Promise 가능).
const KeywordExplainPanel = ({ target, onClose, onSelectKeyword, onOpenMention, onMakeQuiz, canInsert, onInsert }) => {
  const { data, loading, error, retry } = useKeywordExplanation(target);
  const mentions = useKeywordMentions(target);
  const [tab, setTab] = useState('summary');
  const [insertedTab, setInsertedTab] = useState(null);
  const tabLabel = TABS.find(t => t.key === tab).label;

  return (
    <aside aria-label="키워드 설명" className="kx">
      <header className="kx-header">
        <h3 className="kx-title" title={target.keyword}>{target.keyword}</h3>
        <div className="kx-header-actions">
          <button type="button" onClick={() => onMakeQuiz(target)} className="lib-btn">
            문제 만들기
          </button>
          <button type="button" onClick={onClose} aria-label="키워드 설명 닫기" className="lib-btn">
            닫기
          </button>
        </div>
      </header>

      <div className="kx-body custom-scrollbar">
        {loading && (
          <p className="kx-note kx-loading">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
            설명을 만드는 중...
          </p>
        )}

        {error && (
          <div className="kx-error">
            <p>{error}</p>
            <button type="button" onClick={retry} className="lib-btn">다시 시도</button>
          </div>
        )}

        {data && (
          <>
            <section className="kx-section">
              <div role="tablist" aria-label="설명 종류" className="kx-tabs">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className="kx-tab"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="kx-explanation">
                {toSentenceLines(data[tab]).slice(0, tab === 'summary' ? 3 : undefined).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              <p className="kx-note">AI가 만든 설명입니다. 중요한 내용은 강의 자료로 확인하세요.</p>
              <div className="kx-insert">
                <button
                  type="button"
                  disabled={!canInsert}
                  onClick={async () => { if (await onInsert({ text: data[tab], label: tabLabel })) setInsertedTab(tab); }}
                  className="lib-btn"
                >
                  노트에 적용
                </button>
                <span className="kx-note">
                  {!canInsert ? '설명을 만든 노트에서만 적용할 수 있습니다'
                    : insertedTab === tab ? '노트에 적용했습니다' : '적용 전에 넣을 내용을 확인합니다'}
                </span>
              </div>
            </section>

            <section className="kx-section">
              <h4 className="kx-heading">연관 키워드</h4>
              {data.relatedKeywords.length === 0 ? (
                <p className="kx-note">연관 키워드가 없습니다</p>
              ) : (
                <div className="kx-keywords">
                  {data.relatedKeywords.map(keyword => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => onSelectKeyword(keyword)}
                      className="kx-keyword"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="kx-section">
              <h4 className="kx-heading">더 찾아보기</h4>
              {data.resources.length === 0 ? (
                <p className="kx-note">추천 자료가 없습니다</p>
              ) : (
                <ul className="kx-list">
                  {data.resources.map(resource => (
                    <li key={resource.url}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="kx-row"
                      >
                        <span className="kx-row-title">{resource.title}</span>
                        <span className="kx-row-text">{resource.source}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <section className="kx-section">
          <h4 className="kx-heading">노트 언급</h4>
          {mentions.loading && <p className="kx-note">찾는 중...</p>}
          {mentions.error && <p className="kx-note kx-note-error">{mentions.error}</p>}
          {!mentions.loading && !mentions.error && mentions.mentions.length === 0 && (
            <p className="kx-note">이 강의의 노트에서 찾지 못했습니다</p>
          )}
          {mentions.mentions.length > 0 && (
            <ul className="kx-list">
              {mentions.mentions.map((mention, index) => (
                <li key={`${mention.noteId}-${mention.blockId ?? index}`}>
                  <button
                    type="button"
                    onClick={() => onOpenMention(mention)}
                    className="kx-row"
                  >
                    <span className="kx-row-title">{mention.noteTitle || '제목 없는 노트'}</span>
                    <span className="kx-row-text">{mention.preview}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
};

export default KeywordExplainPanel;
