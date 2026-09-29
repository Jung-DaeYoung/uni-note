import React, { useEffect, useRef, useState } from 'react';
import { useNoteTree } from '../../../context/NoteTreeContext';
import { X, Check, BookOpen, Loader2, ChevronRight, Minus, Plus } from 'lucide-react';
import client from '../../../api/client';

// QuizService.java의 MAX_NOTES_PER_QUIZ / MAX_QUESTIONS_PER_TYPE / MAX_TOTAL_QUESTIONS와
// 동일하게 유지한다(수동 미러링 - 백엔드 상수가 바뀌면 함께 갱신 필요).
const MAX_NOTES_PER_QUIZ = 20;
const MAX_QUESTIONS_PER_TYPE = 20;
const MAX_TOTAL_QUESTIONS = 30;

const TYPE_LABELS = {
  MULTIPLE_CHOICE: '객관식',
  OX: 'OX 퀴즈',
  SHORT_ANSWER: '주관식',
};

const TYPE_DESCRIPTIONS = {
  MULTIPLE_CHOICE: '선택지 중 정답을 고르는 문제',
  OX: '참·거짓을 판단하는 문제',
  SHORT_ANSWER: '직접 답을 입력하는 문제',
};

const DIFFICULTY_OPTIONS = [
  { value: 'EASY', label: '하 · 기초', description: '핵심 개념 확인' },
  { value: 'NORMAL', label: '중 · 보통', description: '표준 난이도' },
  { value: 'HARD', label: '상 · 심화', description: '응용 및 심화' },
];

const SCOPE_NOTE = 'NOTE';
const SCOPE_BLOCK = 'BLOCK';

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

// 서버에 저장된 노트 JSON(문자열)에서 선택 가능한 최상위 블록 목록을 만든다.
// 첫 노드는 제목이므로 제외하고, id가 없는 블록(pdfBlock 등)은 선택할 수 없어 따로 표시만 한다.
const parseNoteBlocks = (rawContent) => {
  let doc;
  try {
    doc = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
  } catch {
    return { blocks: [], hasUnselectable: false };
  }
  const nodes = Array.isArray(doc?.content) ? doc.content.slice(1) : [];
  const blocks = [];
  let hasUnselectable = false;
  nodes.forEach((node) => {
    const id = node?.attrs?.id;
    if (!id) {
      hasUnselectable = true;
      return;
    }
    const text = collectText(node).replace(/\s+/g, ' ').trim();
    blocks.push({
      id,
      type: node.type,
      level: node.type === 'heading' ? node.attrs.level || 1 : null,
      preview: text.length > BLOCK_PREVIEW_LENGTH ? `${text.slice(0, BLOCK_PREVIEW_LENGTH)}…` : text,
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

const SummaryStrip = ({ scopeCount, scopeUnit, typeCount, totalQuestions, difficultyLabel }) => (
  <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 shrink-0">
    <span><span className="font-semibold text-blue-600 dark:text-blue-400">{scopeCount}</span>개 {scopeUnit}</span>
    <span><span className="font-semibold text-blue-600 dark:text-blue-400">{typeCount}</span>개 유형</span>
    <span>총 <span className="font-semibold text-blue-600 dark:text-blue-400">{totalQuestions}</span>문항</span>
    <span>{difficultyLabel}</span>
  </div>
);

const NoteTreeRow = ({ note, level, selectedIds, expandedIds, onToggleNote, onToggleExpand }) => {
  const hasChildren = note.children && note.children.length > 0;
  const isExpanded = expandedIds.includes(note.noteId);
  const isSelected = selectedIds.includes(note.noteId);

  return (
    <React.Fragment>
      <div
        className={`flex items-center gap-1 rounded-lg transition-colors group ${isSelected ? 'bg-blue-50/70 dark:bg-blue-500/10' : 'hover:bg-white dark:hover:bg-slate-800'}`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
        <button
          type="button"
          onClick={(e) => hasChildren && onToggleExpand(e, note.noteId)}
          aria-label={isExpanded ? '하위 노트 접기' : '하위 노트 펼치기'}
          aria-expanded={isExpanded}
          className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${!hasChildren ? 'invisible' : ''}`}
        >
          <ChevronRight
            size={14}
            className={`text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </button>
        <label className="flex flex-1 items-center gap-2 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 transition-all"
            checked={isSelected}
            onChange={() => onToggleNote(note.noteId)}
          />
          <span className={`flex-1 truncate text-xs ${isSelected ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100'}`}>
            {note.title || '제목 없는 노트'}
          </span>
        </label>
      </div>
      {hasChildren && isExpanded && (
        <div className="overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          {note.children.map(child => (
            <NoteTreeRow
              key={child.noteId}
              note={child}
              level={level + 1}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onToggleNote={onToggleNote}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </React.Fragment>
  );
};

const ScopeModeToggle = ({ scopeMode, onChange }) => (
  <div role="radiogroup" aria-label="학습 범위 선택" className="mt-2 grid grid-cols-2 gap-2">
    {[
      { value: SCOPE_NOTE, label: '노트 전체' },
      { value: SCOPE_BLOCK, label: '블록 선택' },
    ].map(opt => (
      <button
        key={opt.value}
        type="button"
        role="radio"
        aria-checked={scopeMode === opt.value}
        onClick={() => onChange(opt.value)}
        className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
          scopeMode === opt.value
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/60 text-blue-700 dark:text-blue-300'
            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const BlockScopeSection = ({ blocks, hasUnselectable, loading, error, selectedBlockIds, onToggleBlock }) => (
  <div className="mt-3">
    <p className="text-xs text-slate-500 dark:text-slate-400">현재 노트에서 문제를 생성할 블록을 선택하세요</p>
    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">최근 입력은 자동 저장(약 2초) 후 목록에 반영됩니다</p>
    <div className="mt-2 space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-800/50">
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          블록 목록을 불러오는 중...
        </p>
      ) : error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : blocks.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">선택할 수 있는 블록이 없습니다.</p>
      ) : (
        blocks.map((block, index) => {
          const isSelected = selectedBlockIds.includes(block.id);
          return (
            <label
              key={block.id}
              className={`flex items-center gap-2 py-1.5 px-1 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/70 dark:bg-blue-500/10' : 'hover:bg-white dark:hover:bg-slate-800'}`}
              style={{ paddingLeft: block.type === 'heading' ? `${(block.level - 1) * 12 + 4}px` : undefined }}
            >
              <input
                type="checkbox"
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                checked={isSelected}
                onChange={() => onToggleBlock(index)}
              />
              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {block.type === 'heading' ? `제목 ${block.level}` : BLOCK_TYPE_LABELS[block.type] || block.type}
              </span>
              <span className={`flex-1 truncate text-xs ${block.type === 'heading' ? 'font-semibold' : ''} ${isSelected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                {block.preview || '(내용 없음)'}
              </span>
            </label>
          );
        })
      )}
    </div>
    {hasUnselectable && !loading && !error && (
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">PDF 등 일부 블록은 노트 전체 모드에서만 포함됩니다</p>
    )}
    {!loading && !error && (
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">선택된 블록 {selectedBlockIds.length}개</p>
    )}
  </div>
);

const NoteScopeSection = ({ noteTree, selectedIds, expandedIds, onToggleNote, onToggleExpand }) => (
  <div className="mt-3">
    <p className="text-xs text-slate-500 dark:text-slate-400">문제를 생성할 노트를 선택하세요</p>
    <div className="mt-2 space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-800/50">
      {noteTree.map(note => (
        <NoteTreeRow
          key={note.noteId}
          note={note}
          level={0}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          onToggleNote={onToggleNote}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
    {selectedIds.length === 0 ? (
      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">선택된 노트가 없습니다.</p>
    ) : (
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">선택된 노트 {selectedIds.length}개</p>
    )}
  </div>
);

const QuestionTypeSection = ({ activeTypes, typeCounts, onToggleType, onChangeCount, onBlurCount, onStepCount }) => (
  <div>
    <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">문제 유형 및 문항 수</label>
    <div className="mt-2 space-y-2">
      {Object.keys(activeTypes).map(type => {
        const active = activeTypes[type];
        const count = typeCounts[type];
        return (
          <div
            key={type}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-colors ${
              active ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                checked={active}
                onChange={() => onToggleType(type)}
              />
              <span className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{TYPE_LABELS[type]}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{TYPE_DESCRIPTIONS[type]}</p>
              </span>
            </label>
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => onStepCount(type, -1)}
                disabled={!active || count <= 1}
                aria-label={`${TYPE_LABELS[type]} 문항 수 줄이기`}
                className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Minus size={12} />
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
                className="w-10 text-center text-sm font-semibold bg-transparent outline-none text-slate-900 dark:text-slate-100 disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => onStepCount(type, 1)}
                disabled={!active || count >= MAX_QUESTIONS_PER_TYPE}
                aria-label={`${TYPE_LABELS[type]} 문항 수 늘리기`}
                className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const DifficultySection = ({ difficulty, onChange }) => (
  <div>
    <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">난이도</label>
    <div role="radiogroup" aria-label="난이도 선택" className="mt-2 grid grid-cols-3 gap-2">
      {DIFFICULTY_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={difficulty === opt.value}
          onClick={() => onChange(opt.value)}
          className={`p-3 rounded-lg border text-left transition-colors ${
            difficulty === opt.value
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/60'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.description}</p>
        </button>
      ))}
    </div>
  </div>
);

const QuizConfigModal = ({ isOpen, onClose, currentNoteId, onGenerated, saveStatus = 'synced' }) => {
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
  const [loading, setLoading] = useState(false);
  const [scopeMode, setScopeMode] = useState(SCOPE_NOTE);
  const [blocks, setBlocks] = useState([]);
  const [hasUnselectableBlocks, setHasUnselectableBlocks] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksError, setBlocksError] = useState(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState([]);
  // 블록 모드를 빠르게 껐다 켤 때 늦게 도착한 이전 응답이 목록을 덮어쓰지 않게 한다.
  const blockRequestSeqRef = useRef(0);

  // 이 모달은 isOpen과 무관하게 부모에 항상 마운트되어 있으므로(아래 !isOpen 조기 반환),
  // selectedIds/expandedIds의 useState 초기값은 최초 마운트 시점의 currentNoteId만 캡처한다.
  // CourseDetailPage가 /course/:courseId로 진입한 뒤 내부적으로 첫 노트로 리다이렉트되는
  // 경우 최초 마운트 시 currentNoteId가 아직 undefined일 수 있으므로, 모달이 열릴 때마다
  // 그 시점의 currentNoteId로 다시 동기화한다.
  useEffect(() => {
    if (isOpen) {
      const id = parseInt(currentNoteId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIds([id]);
      setExpandedIds([id]);
      setScopeMode(SCOPE_NOTE);
      setSelectedBlockIds([]);
    }
  }, [isOpen, currentNoteId]);

  if (!isOpen) return null;

  // 블록 모드에 들어갈 때마다 서버 저장본을 다시 읽는다. 서버는 저장본 기준으로 블록을
  // 추출·검증하므로, 목록도 저장본 기준이어야 선택한 블록이 서버에서 "없는 블록"이 되지 않는다.
  const loadBlocks = async () => {
    const seq = ++blockRequestSeqRef.current;
    setBlocksLoading(true);
    setBlocksError(null);
    setSelectedBlockIds([]);
    try {
      const response = await client.get(`/notes/${currentNoteId}`);
      if (seq !== blockRequestSeqRef.current) return;
      const parsed = parseNoteBlocks(response.data?.content);
      setBlocks(parsed.blocks);
      setHasUnselectableBlocks(parsed.hasUnselectable);
    } catch (error) {
      if (seq !== blockRequestSeqRef.current) return;
      setBlocks([]);
      setBlocksError(error.response?.data?.message || '블록 목록을 불러오지 못했습니다.');
    } finally {
      if (seq === blockRequestSeqRef.current) setBlocksLoading(false);
    }
  };

  const changeScopeMode = (mode) => {
    if (mode === scopeMode) return;
    setScopeMode(mode);
    if (mode === SCOPE_BLOCK) {
      loadBlocks();
    } else {
      blockRequestSeqRef.current++;
      setBlocksLoading(false);
    }
  };

  const toggleBlock = (index) => {
    const targetIds = getBlockRangeIds(blocks, index);
    const isSelecting = !selectedBlockIds.includes(blocks[index].id);
    setSelectedBlockIds(prev => (
      isSelecting
        ? [...prev, ...targetIds.filter(id => !prev.includes(id))]
        : prev.filter(id => !targetIds.includes(id))
    ));
  };

  const toggleNote = (noteId) => {
    // 해당 노드와 모든 자식 노드 ID를 찾는 헬퍼 함수
    const getAllChildIds = (nodes, id) => {
      for (const node of nodes) {
        if (node.noteId === id) {
          const ids = [node.noteId];
          const collectChildren = (children) => {
            if (!children) return;
            children.forEach(child => {
              ids.push(child.noteId);
              collectChildren(child.children);
            });
          };
          collectChildren(node.children);
          return ids;
        }
        if (node.children) {
          const found = getAllChildIds(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const targetIds = getAllChildIds(noteTree, noteId) || [noteId];
    const isSelecting = !selectedIds.includes(noteId);

    setSelectedIds(prev => {
      if (isSelecting) {
        // 선택 시: 기존 선택 목록에 대상 ID들 중 없는 것만 추가
        const next = [...prev];
        targetIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      } else {
        // 해제 시: 대상 ID들을 모두 제거
        return prev.filter(id => !targetIds.includes(id));
      }
    });
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

  const isBlockMode = scopeMode === SCOPE_BLOCK;
  const scopeDisabledReason = isBlockMode
    ? (blocksLoading ? '블록 목록을 불러오는 중입니다' :
      blocksError ? blocksError :
      saveStatus === 'saving' ? '노트 자동 저장이 끝난 뒤 생성할 수 있습니다' :
      saveStatus === 'error' ? '노트 저장에 실패했습니다. 저장을 다시 시도한 뒤 생성하세요' :
      selectedBlockIds.length === 0 ? '블록을 하나 이상 선택하세요' :
      null)
    : (selectedIds.length === 0 ? '노트를 하나 이상 선택하세요' :
      selectedIds.length > MAX_NOTES_PER_QUIZ ? `노트는 최대 ${MAX_NOTES_PER_QUIZ}개까지 선택할 수 있습니다` :
      null);

  const disabledReason =
    scopeDisabledReason ? scopeDisabledReason :
    activeTypeCount === 0 ? '문제 유형을 하나 이상 선택하세요' :
    totalQuestions === 0 ? '각 유형의 문항 수를 확인하세요' :
    totalQuestions > MAX_TOTAL_QUESTIONS ? `총 문항 수는 ${MAX_TOTAL_QUESTIONS}개를 초과할 수 없습니다` :
    null;

  const isGenerateDisabled = loading || disabledReason !== null;

  const handleGenerate = async () => {
    if (isGenerateDisabled) return;
    setLoading(true);
    const counts = {};
    Object.keys(activeTypes).forEach(type => {
      if (activeTypes[type]) counts[type] = typeCounts[type];
    });

    // 노트 전체 모드 payload는 기존과 동일하게 두고, 블록 모드에서만 blockIds를 추가한다.
    // blockIds는 노트 안 순서대로 보낸다.
    const payload = isBlockMode
      ? {
        noteIds: [parseInt(currentNoteId)],
        blockIds: blocks.map(block => block.id).filter(id => selectedBlockIds.includes(id)),
        typeCounts: counts,
        difficulty
      }
      : {
        noteIds: selectedIds,
        typeCounts: counts,
        difficulty
      };

    try {
      const response = await client.post('/quiz/generate', payload);
      onGenerated(response.data);
      onClose();
    } catch (error) {
      // 서버가 실패 원인(빈 노트, AI 호출 실패, 생성 결과 검증 실패 등)을 message로 내려주면 그대로 보여준다.
      alert(error.response?.data?.message || '문제 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-config-title"
        className="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[90vh] rounded-xl shadow-xl overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3 shrink-0 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 id="quiz-config-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">AI 문제 생성</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">노트에서 학습 문제를 구성합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="문제 생성 설정 닫기"
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <X size={18} />
          </button>
        </div>

        <SummaryStrip
          scopeCount={isBlockMode ? selectedBlockIds.length : selectedIds.length}
          scopeUnit={isBlockMode ? '블록' : '노트'}
          typeCount={activeTypeCount}
          totalQuestions={totalQuestions}
          difficultyLabel={difficultyLabel}
        />

        {/* fieldset 자체는 스크롤 컨테이너로 신뢰할 수 없어(overflow-y가 적용되어도 scrollTop이
            반영되지 않는 브라우저 렌더링 특이사항이 있음) 스크롤은 바깥 div가 맡고,
            fieldset은 안쪽에서 disabled 상속(로딩 중 입력 일괄 비활성화) 역할만 한다. */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <fieldset disabled={loading} className="p-4 space-y-4 border-0 m-0 min-w-0">
            <div>
              <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">학습 범위</label>
              <ScopeModeToggle scopeMode={scopeMode} onChange={changeScopeMode} />
              {isBlockMode ? (
                <BlockScopeSection
                  blocks={blocks}
                  hasUnselectable={hasUnselectableBlocks}
                  loading={blocksLoading}
                  error={blocksError}
                  selectedBlockIds={selectedBlockIds}
                  onToggleBlock={toggleBlock}
                />
              ) : (
                <NoteScopeSection
                  noteTree={noteTree}
                  selectedIds={selectedIds}
                  expandedIds={expandedIds}
                  onToggleNote={toggleNote}
                  onToggleExpand={toggleExpand}
                />
              )}
            </div>
            <QuestionTypeSection
              activeTypes={activeTypes}
              typeCounts={typeCounts}
              onToggleType={toggleType}
              onChangeCount={handleCountChange}
              onBlurCount={handleCountBlur}
              onStepCount={stepCount}
            />
            <DifficultySection difficulty={difficulty} onChange={setDifficulty} />
          </fieldset>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          {!loading && disabledReason && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{disabledReason}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 text-xs font-semibold py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              className="flex-[2] flex items-center justify-center gap-2 text-xs font-semibold py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>문제 생성 중...</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={3} />
                  <span>문제 생성 시작</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizConfigModal;
