import React, { useEffect, useRef, useState } from 'react';
import { useNoteTree, findNote } from '../../../context/NoteTreeContext';
import { X, Loader2, ChevronRight, Minus, Plus } from 'lucide-react';
import client from '../../../api/client';
import { showAlert } from '../../../context/ConfirmContext';
import '../../../pages/QuizLibraryPage.css';
import './QuizConfigModal.css';

// QuizService.java의 MAX_NOTES_PER_QUIZ / MAX_TOTAL_QUESTIONS, QuizRequest.java의 유형별 상한(@Max)과
// 동일하게 유지한다(수동 미러링 - 백엔드 상수가 바뀌면 함께 갱신 필요).
const MAX_NOTES_PER_QUIZ = 20;
const MAX_QUESTIONS_PER_TYPE = 20;
const MAX_TOTAL_QUESTIONS = 30;
// QuizService.MAX_SELECTED_BLOCKS와 동일(모든 노트를 합친 선택 블록 수 상한).
const MAX_SELECTED_BLOCKS = 500;
// QuizRequest.learningObjectives의 @Size(max = 5) / 항목 @Size(max = 100)와 동일.
const MAX_LEARNING_OBJECTIVES = 5;
const MAX_OBJECTIVE_LENGTH = 100;

// QuizRequest.focusConcepts의 @Size(max = 5)와 동일.
const MAX_FOCUS_CONCEPTS = 5;
// QuizRequest.focusConcepts 항목 @Size(max = 30)와 동일.
const MAX_FOCUS_CONCEPT_LENGTH = 30;

// QuizRequest.referenceQuestions의 @Size(max = 10) / 항목 @Size(max = 500)와 동일.
const MAX_REFERENCE_QUESTIONS = 10;
const MAX_REFERENCE_LENGTH = 500;
// 모의고사 모드의 유형별 문항 수(총 MAX_TOTAL_QUESTIONS 이내).
const MOCK_EXAM_COUNTS = { MULTIPLE_CHOICE: 10, OX: 5, SHORT_ANSWER: 5 };

// 생성 모드(P2-4). 모드는 아래 설정을 채우기만 하고, 학생은 채워진 설정을 고친 뒤 생성할 수 있다.
const GENERATION_MODES = [
  { value: 'CUSTOM', label: '직접 설정', description: '범위와 문항을 직접 고릅니다' },
  { value: 'RECENT', label: '최근 틀린 문제', description: '틀린 문제를 바꿔 다시 출제' },
  { value: 'REVIEW', label: '이번 주 복습', description: '복습할 차례인 문제를 바꿔 출제' },
  { value: 'MOCK', label: '모의고사', description: '강의 노트 전체에서 고르게 출제' },
];

// 학습 목표 입력은 한 줄에 하나. 빈 줄은 무시한다.
const parseObjectives = (text) => text.split('\n').map(line => line.trim()).filter(Boolean);

const TYPE_LABELS = {
  MULTIPLE_CHOICE: '객관식',
  OX: 'OX 퀴즈',
  SHORT_ANSWER: '주관식',
};

const DIFFICULTY_OPTIONS = [
  { value: 'EASY', label: '하 · 기초' },
  { value: 'NORMAL', label: '중 · 보통' },
  { value: 'HARD', label: '상 · 심화' },
];


// BlockId.js 적용 대상 블록의 목록 표시용 라벨
const BLOCK_TYPE_LABELS = {
  paragraph: '문단',
  heading: '제목',
  blockquote: '인용',
  codeBlock: '코드',
  taskList: '체크리스트',
  bulletList: '목록',
  orderedList: '번호 목록',
  image: '이미지',
};
const BLOCK_PREVIEW_LENGTH = 60;

const collectText = (node) => {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  return (node.content || []).map(collectText).join(' ');
};

// 서버가 AI 입력으로 쓰는 미디어(QuizAiGenerationService.extractDataFromNode의 image·pdfBlock)가 있는지.
const hasMedia = (node) => {
  if (!node) return false;
  if (node.type === 'image' || node.type === 'pdfBlock') return true;
  return (node.content || []).some(hasMedia);
};

// 서버에 저장된 노트 JSON(문자열)에서 선택 가능한 최상위 블록 목록을 만든다.
// 첫 노드는 제목이므로 제외하고, id가 없는 블록(pdfBlock 등)은 선택할 수 없어 따로 표시만 한다.
// 텍스트도 미디어도 없는 블록(빈 줄 등)은 골라도 AI 입력이 늘지 않으므로 목록에서 뺀다.
const parseNoteBlocks = (rawContent) => {
  let doc;
  try {
    doc = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
  } catch {
    return { blocks: [], hasUnselectable: false };
  }
  const nodes = Array.isArray(doc?.content) ? doc.content.slice(1) : [];
  const candidates = [];
  let hasUnselectable = false;
  nodes.forEach((node) => {
    const text = collectText(node).replace(/\s+/g, ' ').trim();
    if (!text && !hasMedia(node)) return;
    const id = node?.attrs?.id;
    if (!id) {
      hasUnselectable = true;
      return;
    }
    candidates.push({ node, text, id });
  });
  // 예전 BlockId 버그로 목록 블록끼리 id가 겹쳐 저장됐으면 하나만 골라도 모두 선택되므로,
  // 노트를 에디터로 열어 id가 고쳐지기 전까지 선택 불가로 둔다. 빈 줄·중첩 블록과의 중복은 무시한다.
  const idCounts = {};
  candidates.forEach(({ id }) => { idCounts[id] = (idCounts[id] || 0) + 1; });
  const blocks = [];
  candidates.forEach(({ node, text, id }) => {
    if (idCounts[id] > 1) {
      hasUnselectable = true;
      return;
    }
    blocks.push({
      id,
      type: node.type,
      level: node.type === 'heading' ? node.attrs.level || 1 : null,
      // 텍스트 없이 미디어만 있는 블록(이미지 등)은 미디어 종류로 표시한다.
      preview: !text ? '(이미지)'
        : text.length > BLOCK_PREVIEW_LENGTH ? `${text.slice(0, BLOCK_PREVIEW_LENGTH)}…` : text,
    });
  });
  return { blocks, hasUnselectable };
};

// heading을 선택하면 다음 같은 레벨 이하 heading 전까지의 블록을 함께 선택한다.
const getBlockRangeIds = (blocks, index) => {
  const target = blocks[index];
  if (target.type !== 'heading') return [target.id];
  const ids = [target.id];
  for (let i = index + 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'heading' && block.level <= target.level) break;
    ids.push(block.id);
  }
  return ids;
};

// blockSelections({ noteId: blockId[] }) 불변 갱신 헬퍼. 빈 선택은 키를 남기지 않는다.
const omitNotes = (selections, noteIds) =>
  Object.fromEntries(Object.entries(selections).filter(([id]) => !noteIds.includes(Number(id))));

const withNoteBlocks = (selections, noteId, blockIds) => (
  blockIds.length > 0 ? { ...selections, [noteId]: blockIds } : omitNotes(selections, [noteId])
);

// 선택 요약 칩 목록을 노트 트리 순서대로 만든다(blockCount 0 = 노트 전체).
const collectNoteIds = (nodes) => nodes.flatMap(node => [node.noteId, ...collectNoteIds(node.children || [])]);

const buildSummaryEntries = (nodes, selectedIds, blockSelections) => nodes.flatMap(node => {
  const title = node.title || '제목 없는 노트';
  const self = selectedIds.includes(node.noteId)
    ? [{ noteId: node.noteId, title, blockCount: 0 }]
    : blockSelections[node.noteId]
      ? [{ noteId: node.noteId, title, blockCount: blockSelections[node.noteId].length }]
      : [];
  return [...self, ...buildSummaryEntries(node.children || [], selectedIds, blockSelections)];
});

const SummaryStrip = ({ noteCount, blockNoteCount, blockCount, typeCount, totalQuestions, difficultyLabel }) => (
  <p className="qz-summary">
    <span>
      <strong>{noteCount}</strong>개 노트
      {blockNoteCount > 0 && <span> (블록 선택 {blockNoteCount}개 노트, {blockCount}블록)</span>}
    </span>
    <span><strong>{typeCount}</strong>개 유형</span>
    <span>총 <strong>{totalQuestions}</strong>문항</span>
    <span>{difficultyLabel}</span>
  </p>
);

const BlockTypeBadge = ({ block }) => (
  <span className="qz-block-type">
    {block.type === 'heading' ? `제목 ${block.level}` : BLOCK_TYPE_LABELS[block.type] || block.type}
  </span>
);

// 노트 행 바로 아래에 펼쳐지는 그 노트의 블록 목록. 왼쪽 선과 들여쓰기로 노트 행과 구분한다.
const NoteBlockPanel = ({ note, level, isCurrent, blockState, isWhole, selectedBlockIds, onToggleBlock }) => {
  const { status, blocks = [], hasUnselectable, error } = blockState || { status: 'loading' };
  return (
    <div
      role="group"
      aria-label={`${note.title || '제목 없는 노트'}의 블록`}
      className="qz-blocks"
      style={{ marginLeft: `${level * 16 + 36}px` }}
    >
      {isCurrent && (
        <p className="qz-note">최근 입력은 자동 저장(약 2초) 후 목록에 반영됩니다</p>
      )}
      {status === 'loading' ? (
        <p className="qz-note qz-note-loading">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          블록 목록을 불러오는 중...
        </p>
      ) : status === 'error' ? (
        <p className="qz-note qz-note-error">{error}</p>
      ) : blocks.length === 0 ? (
        <p className="qz-note">선택할 수 있는 블록이 없습니다.</p>
      ) : (
        blocks.map((block, index) => {
          const isSelected = isWhole || selectedBlockIds.includes(block.id);
          return (
            <label
              key={block.id}
              className={`qz-block ${isSelected ? 'qz-is-selected' : ''}`}
              style={{ paddingLeft: `${(block.type === 'heading' ? (block.level - 1) * 12 : 0) + 8}px` }}
            >
              <input
                type="checkbox"
                className="qz-check"
                checked={isSelected}
                onChange={() => onToggleBlock(note.noteId, index)}
              />
              <BlockTypeBadge block={block} />
              <span className={`qz-truncate ${block.type === 'heading' ? 'qz-block-heading' : ''}`}>
                {block.preview}
              </span>
            </label>
          );
        })
      )}
      {status === 'loaded' && hasUnselectable && (
        <p className="qz-note">PDF 등 일부 블록은 노트 전체를 선택할 때만 포함됩니다</p>
      )}
    </div>
  );
};

const NoteTreeRow = ({ note, level, scope }) => {
  const {
    currentNoteId, selectedIds, blockSelections, expandedIds, openBlockPanelIds, blocksByNote,
    onToggleNote, onToggleExpand, onToggleBlockPanel, onToggleBlock,
  } = scope;
  const hasChildren = note.children && note.children.length > 0;
  const isExpanded = expandedIds.includes(note.noteId);
  const isWhole = selectedIds.includes(note.noteId);
  const partialBlockIds = blockSelections[note.noteId] || [];
  const isPartial = partialBlockIds.length > 0;
  const isBlockPanelOpen = openBlockPanelIds.includes(note.noteId);
  const isCurrent = note.noteId === currentNoteId;
  const title = note.title || '제목 없는 노트';

  return (
    <React.Fragment>
      <div
        className={`qz-row ${isWhole || isPartial ? 'qz-is-selected' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
      >
        <button
          type="button"
          onClick={(e) => hasChildren && onToggleExpand(e, note.noteId)}
          aria-label={isExpanded ? '하위 노트 접기' : '하위 노트 펼치기'}
          aria-expanded={isExpanded}
          className={`lib-icon qz-expand ${!hasChildren ? 'qz-hidden' : ''}`}
        >
          <ChevronRight size={14} className={`qz-chevron ${isExpanded ? 'qz-chevron-open' : ''}`} />
        </button>
        <label className="qz-row-label">
          {/* 일부 블록만 고른 노트는 indeterminate(부분 선택)로 표시한다. DOM 속성이라 ref로 설정한다. */}
          <input
            ref={el => { if (el) el.indeterminate = isPartial; }}
            type="checkbox"
            className="qz-check"
            checked={isWhole}
            onChange={() => onToggleNote(note.noteId)}
          />
          <span className="qz-truncate">{title}</span>
        </label>
        {isCurrent && <span className="qz-tag">현재 노트</span>}
        {isWhole && <span className="qz-tag qz-tag-on">전체</span>}
        {isPartial && <span className="qz-tag qz-tag-on">블록 {partialBlockIds.length}개</span>}
        <button
          type="button"
          onClick={() => onToggleBlockPanel(note.noteId)}
          aria-expanded={isBlockPanelOpen}
          aria-label={`${title} 블록 선택 ${isBlockPanelOpen ? '닫기' : '열기'}`}
          className="qz-link"
        >
          블록
        </button>
      </div>
      {isBlockPanelOpen && (
        <NoteBlockPanel
          note={note}
          level={level}
          isCurrent={isCurrent}
          blockState={blocksByNote[note.noteId]}
          isWhole={isWhole}
          selectedBlockIds={partialBlockIds}
          onToggleBlock={onToggleBlock}
        />
      )}
      {hasChildren && isExpanded && note.children.map(child => (
        <NoteTreeRow key={child.noteId} note={child} level={level + 1} scope={scope} />
      ))}
    </React.Fragment>
  );
};

// 선택한 노트를 노트 단위로 한눈에 보여준다. ✕는 그 노트 하나만 해제한다(하위 노트는 그대로).
const SelectionSummary = ({ entries, onRemove }) => (
  entries.length === 0 ? (
    <p className="qz-hint qz-hint-gap">선택된 노트가 없습니다.</p>
  ) : (
    <div className="qz-selection">
      <p className="qz-hint">선택 요약</p>
      <ul aria-label="선택 요약" className="qz-chips">
        {entries.map(entry => (
          <li key={entry.noteId} className="qz-chip">
            <span className="qz-truncate qz-chip-title">{entry.title}</span>
            <span className="qz-chip-scope">
              · {entry.blockCount ? `블록 ${entry.blockCount}개` : '전체'}
            </span>
            <button
              type="button"
              onClick={() => onRemove(entry.noteId)}
              aria-label={`${entry.title} 선택 해제`}
              className="qz-chip-remove"
            >
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
);

const NoteScopeSection = ({ noteTree, scope, summaryEntries, onRemoveSelection, onSelectWeakBlocks, weakLoading }) => (
  <section className="qz-section">
    <div className="qz-section-head">
      <h3 className="qz-heading">학습 범위</h3>
      <button type="button" onClick={onSelectWeakBlocks} disabled={weakLoading} className="lib-btn">
        {weakLoading ? '불러오는 중...' : '취약 블록 선택'}
      </button>
    </div>
    <p className="qz-hint">노트를 체크하면 노트 전체를, "블록"을 눌러 일부 블록만 선택할 수 있습니다</p>
    <div className="qz-list">
      {noteTree.map(note => (
        <NoteTreeRow key={note.noteId} note={note} level={0} scope={scope} />
      ))}
    </div>
    <SelectionSummary entries={summaryEntries} onRemove={onRemoveSelection} />
  </section>
);

const QuestionTypeSection = ({ activeTypes, typeCounts, onToggleType, onChangeCount, onBlurCount, onStepCount }) => (
  <section className="qz-section">
    <h3 className="qz-heading">문제 유형 및 문항 수</h3>
    <div className="qz-list">
      {Object.keys(activeTypes).map(type => {
        const active = activeTypes[type];
        const count = typeCounts[type];
        return (
          <div key={type} className="qz-type">
            <label className="qz-row-label">
              <input
                type="checkbox"
                className="qz-check"
                checked={active}
                onChange={() => onToggleType(type)}
              />
              <span>{TYPE_LABELS[type]}</span>
            </label>
            <div className="qz-stepper">
              <button
                type="button"
                onClick={() => onStepCount(type, -1)}
                disabled={!active || count <= 1}
                aria-label={`${TYPE_LABELS[type]} 문항 수 줄이기`}
                className="qz-step"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={1}
                max={MAX_QUESTIONS_PER_TYPE}
                value={count}
                onChange={(e) => onChangeCount(type, e.target.value)}
                onBlur={() => onBlurCount(type)}
                disabled={!active}
                aria-label={`${TYPE_LABELS[type]} 문항 수`}
                className="qz-count"
              />
              <button
                type="button"
                onClick={() => onStepCount(type, 1)}
                disabled={!active || count >= MAX_QUESTIONS_PER_TYPE}
                aria-label={`${TYPE_LABELS[type]} 문항 수 늘리기`}
                className="qz-step"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

const ModeSection = ({ mode, onSelect, loading, referenceCount, coverAllNotes }) => (
  <section className="qz-section">
    <h3 className="qz-heading">생성 모드</h3>
    <div role="radiogroup" aria-label="생성 모드 선택" className="qz-list">
      {GENERATION_MODES.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={mode === opt.value}
          onClick={() => onSelect(opt.value)}
          disabled={loading}
          className="qz-mode"
        >
          <span className="qz-mode-label">{opt.label}</span>
          <span className="qz-mode-desc">{opt.description}</span>
        </button>
      ))}
    </div>
    {loading && <p className="qz-hint qz-hint-gap">불러오는 중...</p>}
    {referenceCount > 0 && (
      <p className="qz-hint qz-hint-gap qz-hint-accent">틀린 문제 {referenceCount}개를 다른 형태로 바꿔 출제합니다</p>
    )}
    {coverAllNotes && (
      <p className="qz-hint qz-hint-gap qz-hint-accent">선택한 노트마다 1문항 이상 출제합니다</p>
    )}
  </section>
);

const DifficultySection = ({ difficulty, onChange }) => (
  <section className="qz-section">
    <h3 className="qz-heading">난이도</h3>
    <div role="radiogroup" aria-label="난이도 선택" className="qz-segments">
      {DIFFICULTY_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={difficulty === opt.value}
          onClick={() => onChange(opt.value)}
          className="qz-segment"
        >
          {opt.label}
        </button>
      ))}
    </div>
  </section>
);

const LearningObjectivesSection = ({ value, onChange }) => (
  <section className="qz-section">
    <label htmlFor="quiz-learning-objectives" className="qz-heading">
      학습 목표 <span className="qz-optional">(선택, 한 줄에 하나·최대 {MAX_LEARNING_OBJECTIVES}개)</span>
    </label>
    <textarea
      id="quiz-learning-objectives"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      placeholder={'예) 페이지 교체 알고리즘의 차이를 비교할 수 있다'}
      className="qz-textarea"
    />
  </section>
);

const FocusConceptSection = ({ concepts, onLoad, onRemove, loading }) => (
  <section className="qz-section">
    <div className="qz-section-head">
      <h3 className="qz-heading">
        집중할 개념 <span className="qz-optional">(선택)</span>
      </h3>
      <button type="button" onClick={onLoad} disabled={loading} className="lib-btn">
        {loading ? '불러오는 중...' : '취약 개념 불러오기'}
      </button>
    </div>
    <p className="qz-hint">자주 틀린 개념을 다른 형태의 문제로 다시 출제합니다. 선택한 노트 범위에 있는 개념만 출제됩니다</p>
    {concepts.length > 0 && (
      <div className="qz-chips qz-chips-gap">
        {concepts.map(concept => (
          <span key={concept} className="qz-chip">
            {concept}
            <button
              type="button"
              onClick={() => onRemove(concept)}
              aria-label={`${concept} 개념 제외`}
              className="qz-chip-remove"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    )}
  </section>
);

// preset({ noteId, blockId, keyword })이 있으면 열 때 그 블록(없으면 노트 전체)을 범위로, 키워드를 집중 개념으로 채운다.
const QuizConfigModal = ({ isOpen, onClose, currentNoteId, courseId, onGenerated, saveStatus = 'synced', preset = null }) => {
  const { noteTree } = useNoteTree();
  const [selectedIds, setSelectedIds] = useState([parseInt(currentNoteId)]);
  const [expandedIds, setExpandedIds] = useState([parseInt(currentNoteId)]); // 현재 노트의 부모들은 펼쳐진 상태로 시작하는 것이 좋지만, 일단 현재 노드만 포함
  const [typeCounts, setTypeCounts] = useState({
    MULTIPLE_CHOICE: 2,
    OX: 2,
    SHORT_ANSWER: 1
  });
  const [activeTypes, setActiveTypes] = useState({
    MULTIPLE_CHOICE: true,
    OX: true,
    SHORT_ANSWER: true
  });
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [objectivesText, setObjectivesText] = useState('');
  const [focusConcepts, setFocusConcepts] = useState([]);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  // 노트별 범위: selectedIds는 "전체" 노트, blockSelections는 { noteId: blockId[] }로 "일부 블록" 노트다.
  // 한 노트가 두 곳에 동시에 있지 않도록 유지한다.
  const [blockSelections, setBlockSelections] = useState({});
  // 노트별 블록 목록 캐시: { noteId: { status: 'loading'|'loaded'|'error', blocks, hasUnselectable, error } }
  const [blocksByNote, setBlocksByNote] = useState({});
  const [openBlockPanelIds, setOpenBlockPanelIds] = useState([]);
  const [weakLoading, setWeakLoading] = useState(false);
  const [mode, setMode] = useState('CUSTOM');
  const [modeLoading, setModeLoading] = useState(false);
  const [referenceQuestions, setReferenceQuestions] = useState([]);
  const [coverAllNotes, setCoverAllNotes] = useState(false);
  // 같은 노트의 목록을 다시 불러올 때 늦게 도착한 이전 응답이 목록을 덮어쓰지 않게 한다.
  const blockRequestSeqRef = useRef(new Map());

  // 이 모달은 isOpen과 무관하게 부모에 항상 마운트되어 있으므로(아래 !isOpen 조기 반환),
  // selectedIds/expandedIds의 useState 초기값은 최초 마운트 시점의 currentNoteId만 캡처한다.
  // CourseDetailPage가 /course/:courseId로 진입한 뒤 내부적으로 첫 노트로 리다이렉트되는
  // 경우 최초 마운트 시 currentNoteId가 아직 undefined일 수 있으므로, 모달이 열릴 때마다
  // 그 시점의 currentNoteId로 다시 동기화한다.
  useEffect(() => {
    if (isOpen) {
      const id = preset ? preset.noteId : parseInt(currentNoteId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIds(preset?.blockId ? [] : [id]);
      setExpandedIds([id]);
      setBlockSelections(preset?.blockId ? { [id]: [preset.blockId] } : {});
      setOpenBlockPanelIds([]);
      // 다른 노트의 저장본이 모달을 닫은 사이 바뀌었을 수 있으므로 캐시도 비운다.
      setBlocksByNote({});
      setMode('CUSTOM');
      setReferenceQuestions([]);
      setCoverAllNotes(false);
      setObjectivesText('');
      setFocusConcepts(preset && preset.keyword.length <= MAX_FOCUS_CONCEPT_LENGTH ? [preset.keyword] : []);
    }
  }, [isOpen, currentNoteId, preset]);

  if (!isOpen) return null;

  const currentId = parseInt(currentNoteId);

  // 노트의 서버 저장본에서 블록 목록을 읽는다. 서버는 저장본 기준으로 블록을 추출·검증하므로,
  // 목록도 저장본 기준이어야 선택한 블록이 서버에서 "없는 블록"이 되지 않는다.
  const loadBlocks = async (noteId) => {
    const seq = (blockRequestSeqRef.current.get(noteId) || 0) + 1;
    blockRequestSeqRef.current.set(noteId, seq);
    setBlocksByNote(prev => ({ ...prev, [noteId]: { ...prev[noteId], status: 'loading', error: null } }));
    try {
      const response = await client.get(`/notes/${noteId}`);
      if (seq !== blockRequestSeqRef.current.get(noteId)) return;
      const parsed = parseNoteBlocks(response.data?.content);
      setBlocksByNote(prev => ({ ...prev, [noteId]: { status: 'loaded', ...parsed, error: null } }));
      // 다시 읽은 저장본에서 사라진 블록은 선택에서 뺀다.
      const validIds = parsed.blocks.map(block => block.id);
      setBlockSelections(prev => (
        prev[noteId] ? withNoteBlocks(prev, noteId, prev[noteId].filter(id => validIds.includes(id))) : prev
      ));
    } catch (error) {
      if (seq !== blockRequestSeqRef.current.get(noteId)) return;
      const message = error.response?.data?.message || '블록 목록을 불러오지 못했습니다.';
      setBlocksByNote(prev => ({
        ...prev,
        [noteId]: { status: 'error', blocks: [], hasUnselectable: false, error: message },
      }));
    }
  };

  // 다른 노트는 처음 펼칠 때 한 번만 읽고, 편집 중인 현재 노트는 펼칠 때마다 다시 읽는다.
  const toggleBlockPanel = (noteId) => {
    const isOpening = !openBlockPanelIds.includes(noteId);
    setOpenBlockPanelIds(prev => (isOpening ? [...prev, noteId] : prev.filter(id => id !== noteId)));
    if (isOpening && (noteId === currentId || !blocksByNote[noteId] || blocksByNote[noteId].status === 'error')) {
      loadBlocks(noteId);
    }
  };

  const toggleBlock = (noteId, index) => {
    const blocks = blocksByNote[noteId]?.blocks || [];
    const targetIds = getBlockRangeIds(blocks, index);
    const isWhole = selectedIds.includes(noteId);
    // 노트 전체가 선택된 상태에서 블록을 해제하면, 나머지 블록만 선택된 상태로 바뀐다.
    const current = isWhole ? blocks.map(block => block.id) : (blockSelections[noteId] || []);
    const isSelecting = !current.includes(blocks[index].id);
    const nextIds = isSelecting
      ? [...new Set([...current, ...targetIds])]
      : current.filter(id => !targetIds.includes(id));

    if (isWhole) {
      setSelectedIds(prev => prev.filter(id => id !== noteId));
    }
    setBlockSelections(prev => withNoteBlocks(prev, noteId, nextIds));
  };

  // 풀이 기록에서 취약(HIGH)한 출처 블록으로 범위를 바꾼다. 다른 강의·삭제된 노트의 블록은
  // 현재 트리에 없으므로 빼고, 저장본에서 사라진 블록은 loadBlocks가 선택에서 뺀다.
  // 현재 강의의 HIGH 개념을 서버 정렬(취약한 순) 그대로 최대 MAX_FOCUS_CONCEPTS개 가져온다.
  const loadWeakConcepts = async () => {
    setConceptLoading(true);
    try {
      const response = await client.get('/quiz/incorrect/statistics/concepts');
      const weak = (response.data || [])
        .filter(stat => stat.reviewPriority === 'HIGH' && stat.courseId === Number(courseId))
        .map(stat => stat.conceptTag)
        .slice(0, MAX_FOCUS_CONCEPTS);
      if (weak.length === 0) {
        showAlert('이 강의에서 자주 틀린 개념이 없습니다.');
        return;
      }
      setFocusConcepts(weak);
    } catch (error) {
      showAlert(error.response?.data?.message || '취약 개념을 불러오지 못했습니다.');
    } finally {
      setConceptLoading(false);
    }
  };

  const selectWeakBlocks = async () => {
    setWeakLoading(true);
    try {
      const response = await client.get('/quiz/incorrect/statistics/blocks');
      const treeNoteIds = new Set(collectNoteIds(noteTree));
      const weakByNote = {};
      (response.data || [])
        .filter(stat => stat.reviewPriority === 'HIGH' && treeNoteIds.has(stat.noteId))
        .forEach(stat => {
          weakByNote[stat.noteId] = [...(weakByNote[stat.noteId] || []), stat.blockId];
        });
      if (Object.keys(weakByNote).length === 0) {
        showAlert('이 강의의 노트에서 자주 틀린 블록이 없습니다.');
        return;
      }
      applyBlockSelections(weakByNote);
    } catch (error) {
      showAlert(error.response?.data?.message || '취약 블록을 불러오지 못했습니다.');
    } finally {
      setWeakLoading(false);
    }
  };

  // 블록 범위를 { noteId: blockId[] }로 바꾸고, 저장본 블록 목록을 읽어 사라진 블록을 뺀다.
  const applyBlockSelections = (byNote) => {
    const noteIds = Object.keys(byNote).map(Number);
    setSelectedIds([]);
    setBlockSelections(byNote);
    setOpenBlockPanelIds(noteIds);
    noteIds.forEach(noteId => loadBlocks(noteId));
  };

  // 틀린 문제들로 설정을 채운다: 범위 = 출처 블록, 개념 = 개념 태그, 유형별 수 = 틀린 문제의 유형별 수,
  // 참고 문제 = 문제 원문. 출처가 없거나 다른 강의 노트인 문제는 범위에 쓰지 않는다.
  const applyIncorrectQuestions = (questions) => {
    const picked = questions.slice(0, MAX_REFERENCE_QUESTIONS);
    const treeNoteIds = new Set(collectNoteIds(noteTree));
    const byNote = {};
    picked
      .filter(q => q.sourceBlockId && treeNoteIds.has(q.sourceNoteId))
      .forEach(q => {
        byNote[q.sourceNoteId] = [...new Set([...(byNote[q.sourceNoteId] || []), q.sourceBlockId])];
      });
    if (Object.keys(byNote).length > 0) applyBlockSelections(byNote);

    const counts = {};
    picked.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
    setTypeCounts(prev => ({ ...prev, ...counts }));
    setActiveTypes(Object.fromEntries(Object.keys(TYPE_LABELS).map(type => [type, Boolean(counts[type])])));
    setFocusConcepts([...new Set(picked.flatMap(q => q.conceptTags || []))].slice(0, MAX_FOCUS_CONCEPTS));
    setReferenceQuestions(picked.map(q => q.questionText.trim().slice(0, MAX_REFERENCE_LENGTH)));
    setCoverAllNotes(false);
  };

  const applyMockExam = () => {
    const noteIds = collectNoteIds(noteTree);
    if (noteIds.length > MAX_NOTES_PER_QUIZ) {
      showAlert(`노트가 많아 앞의 ${MAX_NOTES_PER_QUIZ}개만 선택했습니다.`);
    }
    setSelectedIds(noteIds.slice(0, MAX_NOTES_PER_QUIZ));
    setBlockSelections({});
    setOpenBlockPanelIds([]);
    setTypeCounts(MOCK_EXAM_COUNTS);
    setActiveTypes({ MULTIPLE_CHOICE: true, OX: true, SHORT_ANSWER: true });
    setDifficulty('NORMAL');
    setFocusConcepts([]);
    setReferenceQuestions([]);
    setCoverAllNotes(true);
  };

  const selectMode = async (nextMode) => {
    if (nextMode === 'CUSTOM') {
      setReferenceQuestions([]);
      setCoverAllNotes(false);
      setMode(nextMode);
      return;
    }
    if (nextMode === 'MOCK') {
      applyMockExam();
      setMode(nextMode);
      return;
    }
    setModeLoading(true);
    try {
      const params = { courseId, limit: MAX_REFERENCE_QUESTIONS };
      const questions = nextMode === 'RECENT'
        ? (await client.get('/quiz/incorrect/recent', { params })).data || []
        // 이번 주: 오늘부터 6일 뒤까지 복습일이 오는 문제
        : ((await client.get('/quiz/incorrect/review-today', { params: { ...params, withinDays: 6 } })).data || [])
          .map(item => item.question);
      if (questions.length === 0) {
        showAlert(nextMode === 'RECENT' ? '이 강의에서 틀린 문제가 없습니다.' : '이번 주에 복습할 문제가 없습니다.');
        return;
      }
      applyIncorrectQuestions(questions);
      setMode(nextMode);
    } catch (error) {
      showAlert(error.response?.data?.message || '틀린 문제를 불러오지 못했습니다.');
    } finally {
      setModeLoading(false);
    }
  };

  const removeSelection = (noteId) => {
    setSelectedIds(prev => prev.filter(id => id !== noteId));
    setBlockSelections(prev => omitNotes(prev, [noteId]));
  };

  const toggleNote = (noteId) => {
    // 해당 노트와 모든 하위 노트 ID
    const note = findNote(noteTree, noteId);
    const targetIds = note ? collectNoteIds([note]) : [noteId];
    const isSelecting = !selectedIds.includes(noteId);

    setSelectedIds(prev => (isSelecting
      ? [...new Set([...prev, ...targetIds])]
      : prev.filter(id => !targetIds.includes(id))));
    // 노트 체크박스는 "전체" 선택이다. 선택하면 일부 블록 선택을 전체로 바꾸고, 해제하면 함께 비운다.
    setBlockSelections(prev => (targetIds.some(id => prev[id]) ? omitNotes(prev, targetIds) : prev));
  };

  const toggleExpand = (e, noteId) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedIds(prev =>
      prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
    );
  };

  const toggleType = (type) => {
    setActiveTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // 빈 값은 일단 그대로 두고(사용자가 계속 입력 중일 수 있음), blur 시점에 1로 복구한다.
  // 그 외 값은 즉시 1~MAX_QUESTIONS_PER_TYPE 범위로 정규화해 NaN이 state에 들어가지 않게 한다.
  const handleCountChange = (type, rawValue) => {
    if (rawValue === '') {
      setTypeCounts(prev => ({ ...prev, [type]: '' }));
      return;
    }
    const n = Number(rawValue);
    if (Number.isNaN(n)) return;
    setTypeCounts(prev => ({ ...prev, [type]: Math.min(MAX_QUESTIONS_PER_TYPE, Math.max(1, Math.trunc(n))) }));
  };

  const handleCountBlur = (type) => {
    setTypeCounts(prev => {
      const value = prev[type];
      if (value === '' || value < 1) {
        return { ...prev, [type]: 1 };
      }
      return prev;
    });
  };

  const stepCount = (type, delta) => {
    setTypeCounts(prev => {
      const current = typeof prev[type] === 'number' ? prev[type] : 1;
      return { ...prev, [type]: Math.min(MAX_QUESTIONS_PER_TYPE, Math.max(1, current + delta)) };
    });
  };

  const activeTypeCount = Object.values(activeTypes).filter(Boolean).length;
  const totalQuestions = Object.entries(activeTypes).reduce(
    (sum, [type, active]) => sum + (active && typeof typeCounts[type] === 'number' ? typeCounts[type] : 0),
    0
  );
  const difficultyLabel = DIFFICULTY_OPTIONS.find(opt => opt.value === difficulty)?.label ?? difficulty;

  const partialNoteIds = Object.keys(blockSelections).map(Number);
  const selectedNoteCount = selectedIds.length + partialNoteIds.length;
  const selectedBlockCount = partialNoteIds.reduce((sum, id) => sum + blockSelections[id].length, 0);
  const isPartialLoading = partialNoteIds.some(id => blocksByNote[id]?.status === 'loading');
  // 편집 중인 현재 노트의 블록을 골랐을 때만 자동 저장 상태를 기다린다(다른 노트는 편집 중이 아님).
  const isCurrentPartial = partialNoteIds.includes(currentId);

  const summaryEntries = buildSummaryEntries(noteTree, selectedIds, blockSelections);
  const objectives = parseObjectives(objectivesText);

  const disabledReason =
    selectedNoteCount === 0 ? '노트를 하나 이상 선택하세요' :
    selectedNoteCount > MAX_NOTES_PER_QUIZ ? `노트는 최대 ${MAX_NOTES_PER_QUIZ}개까지 선택할 수 있습니다` :
    selectedBlockCount > MAX_SELECTED_BLOCKS ? `블록은 최대 ${MAX_SELECTED_BLOCKS}개까지 선택할 수 있습니다` :
    isPartialLoading ? '블록 목록을 불러오는 중입니다' :
    isCurrentPartial && saveStatus === 'saving' ? '노트 자동 저장이 끝난 뒤 생성할 수 있습니다' :
    isCurrentPartial && saveStatus === 'error' ? '노트 저장에 실패했습니다. 저장을 다시 시도한 뒤 생성하세요' :
    activeTypeCount === 0 ? '문제 유형을 하나 이상 선택하세요' :
    totalQuestions === 0 ? '각 유형의 문항 수를 확인하세요' :
    totalQuestions > MAX_TOTAL_QUESTIONS ? `총 문항 수는 ${MAX_TOTAL_QUESTIONS}개를 초과할 수 없습니다` :
    objectives.length > MAX_LEARNING_OBJECTIVES ? `학습 목표는 최대 ${MAX_LEARNING_OBJECTIVES}개까지 입력할 수 있습니다` :
    objectives.some(o => o.length > MAX_OBJECTIVE_LENGTH) ? `학습 목표는 한 줄에 ${MAX_OBJECTIVE_LENGTH}자까지 입력할 수 있습니다` :
    null;

  const isGenerateDisabled = loading || disabledReason !== null;

  const handleGenerate = async () => {
    if (isGenerateDisabled) return;
    setLoading(true);
    const counts = {};
    Object.keys(activeTypes).forEach(type => {
      if (activeTypes[type]) counts[type] = typeCounts[type];
    });

    // 블록 선택이 없으면 payload는 기존과 동일하다. 있으면 일부 블록 노트도 noteIds에 넣고
    // blockSelections에 노트별 blockIds를 노트 안 순서대로 담는다.
    const payload = {
      noteIds: [...selectedIds, ...partialNoteIds],
      ...(partialNoteIds.length > 0 && {
        blockSelections: partialNoteIds.map(noteId => ({
          noteId,
          // 블록 목록을 불러오지 않은 노트(preset 등)는 선택값을 그대로 보낸다. 없는 블록은 서버가 400으로 알린다.
          blockIds: blocksByNote[noteId]?.blocks
            ? blocksByNote[noteId].blocks.map(block => block.id).filter(id => blockSelections[noteId].includes(id))
            : blockSelections[noteId],
        })),
      }),
      typeCounts: counts,
      difficulty,
      // 학습 목표가 없으면 필드를 보내지 않아 기존 payload와 같다.
      ...(objectives.length > 0 && { learningObjectives: objectives }),
      ...(focusConcepts.length > 0 && { focusConcepts }),
      ...(referenceQuestions.length > 0 && { referenceQuestions }),
      ...(coverAllNotes && { coverAllNotes: true }),
    };

    try {
      const response = await client.post('/quiz/generate', payload);
      onGenerated(response.data);
      onClose();
    } catch (error) {
      // 서버가 실패 원인(빈 노트, AI 호출 실패, 생성 결과 검증 실패 등)을 message로 내려주면 그대로 보여준다.
      showAlert(error.response?.data?.message || '문제 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="qz-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-config-title"
        className="qz"
      >
        <header className="qz-header">
          <h2 id="quiz-config-title" className="qz-title">AI 문제 생성</h2>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="문제 생성 설정 닫기"
            className="lib-icon"
          >
            <X size={18} />
          </button>
        </header>

        {/* fieldset 자체는 스크롤 컨테이너로 신뢰할 수 없어(overflow-y가 적용되어도 scrollTop이
            반영되지 않는 브라우저 렌더링 특이사항이 있음) 스크롤은 바깥 div가 맡고,
            fieldset은 안쪽에서 disabled 상속(로딩 중 입력 일괄 비활성화) 역할만 한다. */}
        <div className="qz-body custom-scrollbar">
          <fieldset disabled={loading} className="qz-fields">
            <ModeSection
              mode={mode}
              onSelect={selectMode}
              loading={modeLoading}
              referenceCount={referenceQuestions.length}
              coverAllNotes={coverAllNotes}
            />
            <NoteScopeSection
              noteTree={noteTree}
              scope={{
                currentNoteId: currentId,
                selectedIds,
                blockSelections,
                expandedIds,
                openBlockPanelIds,
                blocksByNote,
                onToggleNote: toggleNote,
                onToggleExpand: toggleExpand,
                onToggleBlockPanel: toggleBlockPanel,
                onToggleBlock: toggleBlock,
              }}
              summaryEntries={summaryEntries}
              onRemoveSelection={removeSelection}
              onSelectWeakBlocks={selectWeakBlocks}
              weakLoading={weakLoading}
            />
            <QuestionTypeSection
              activeTypes={activeTypes}
              typeCounts={typeCounts}
              onToggleType={toggleType}
              onChangeCount={handleCountChange}
              onBlurCount={handleCountBlur}
              onStepCount={stepCount}
            />
            <DifficultySection difficulty={difficulty} onChange={setDifficulty} />
            <LearningObjectivesSection value={objectivesText} onChange={setObjectivesText} />
            <FocusConceptSection
              concepts={focusConcepts}
              onLoad={loadWeakConcepts}
              onRemove={(concept) => setFocusConcepts(prev => prev.filter(c => c !== concept))}
              loading={conceptLoading}
            />
          </fieldset>
        </div>

        <footer className="qz-footer">
          <SummaryStrip
            noteCount={selectedNoteCount}
            blockNoteCount={partialNoteIds.length}
            blockCount={selectedBlockCount}
            typeCount={activeTypeCount}
            totalQuestions={totalQuestions}
            difficultyLabel={difficultyLabel}
          />
          {!loading && disabledReason && (
            <p className="qz-reason">{disabledReason}</p>
          )}
          <div className="qz-footer-actions">
            <button onClick={onClose} disabled={loading} className="lib-btn">
              취소
            </button>
            <button onClick={handleGenerate} disabled={isGenerateDisabled} className="lib-btn lib-btn-primary">
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                  <span>문제 생성 중...</span>
                </>
              ) : (
                <span>문제 생성 시작</span>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default QuizConfigModal;
