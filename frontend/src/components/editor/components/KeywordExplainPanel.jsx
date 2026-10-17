import React, { useState } from 'react';
import { BookOpen, ExternalLink, FileText, Loader2, X } from 'lucide-react';
import useKeywordExplanation from '../../../hooks/useKeywordExplanation';
import useKeywordMentions from '../../../hooks/useKeywordMentions';

const TABS = [
  { key: 'summary', label: '3줄 요약' },
  { key: 'easyExplanation', label: '쉬운 설명' },
  { key: 'advancedExplanation', label: '전공 심화' },
];

// 오른쪽 고정 패널(CourseBoardPanel과 같은 자리). 키워드가 바뀌면 부모가 key로 새로 마운트해 탭을 초기화한다.
// canInsert: 설명을 만든 노트를 지금 편집 중인지. onInsert({ text, label })는 삽입 성공 여부를 돌려준다.
const KeywordExplainPanel = ({ target, onClose, onSelectKeyword, onOpenMention, onMakeQuiz, canInsert, onInsert }) => {
  const { data, loading, error, retry } = useKeywordExplanation(target);
  const mentions = useKeywordMentions(target);
  const [tab, setTab] = useState('summary');
  const [insertedTab, setInsertedTab] = useState(null);
  const tabLabel = TABS.find(t => t.key === tab).label;

  return (
    <aside
      aria-label="키워드 설명"
      className="fixed right-0 top-[48px] h-[calc(100vh-48px)] w-[400px] max-w-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-20 flex flex-col"
    >
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center shrink-0">
            <BookOpen size={14} className="text-white" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{target.keyword}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onMakeQuiz(target)}
            className="px-2 py-1 rounded-md text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10"
          >
            문제 만들기
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="키워드 설명 닫기"
            className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 size={14} className="animate-spin" />
            설명을 만드는 중...
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400">
            <p>{error}</p>
            <button type="button" onClick={retry} className="mt-2 font-semibold underline">다시 시도</button>
          </div>
        )}

        {data && (
          <>
            <div>
              <div role="tablist" aria-label="설명 종류" className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={`py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      tab === t.key
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p role="tabpanel" className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line">
                {data[tab]}
              </p>
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">AI가 만든 설명입니다. 중요한 내용은 강의 자료로 확인하세요.</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canInsert}
                  onClick={() => { if (onInsert({ text: data[tab], label: tabLabel })) setInsertedTab(tab); }}
                  className="px-2 py-1 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
                >
                  노트에 삽입
                </button>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {!canInsert ? '설명을 만든 노트에서만 삽입할 수 있습니다'
                    : insertedTab === tab ? '노트에 삽입했습니다' : '이 탭의 설명을 선택한 블록 뒤에 넣습니다'}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">연관 키워드</h4>
              {data.relatedKeywords.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">연관 키워드가 없습니다</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.relatedKeywords.map(keyword => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => onSelectKeyword(keyword)}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">더 찾아보기</h4>
              {data.resources.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">추천 자료가 없습니다</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.resources.map(resource => (
                    <li key={resource.url}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {resource.title}
                          <ExternalLink size={11} className="shrink-0 text-slate-400" />
                        </span>
                        <span className="block mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{resource.source}</span>
                        {resource.reason && (
                          <span className="block mt-1 text-xs text-slate-600 dark:text-slate-300">{resource.reason}</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div>
          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">노트 언급</h4>
          {mentions.loading && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">찾는 중...</p>}
          {mentions.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{mentions.error}</p>}
          {!mentions.loading && !mentions.error && mentions.mentions.length === 0 && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">이 강의의 노트에서 찾지 못했습니다</p>
          )}
          {mentions.mentions.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {mentions.mentions.map((mention, index) => (
                <li key={`${mention.noteId}-${mention.blockId ?? index}`}>
                  <button
                    type="button"
                    onClick={() => onOpenMention(mention)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <FileText size={12} className="shrink-0 text-slate-400" />
                      {mention.noteTitle || '제목 없는 노트'}
                    </span>
                    <span className="block mt-1 text-xs text-slate-600 dark:text-slate-300">{mention.preview}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
};

export default KeywordExplainPanel;
