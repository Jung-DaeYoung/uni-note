import React, { useState } from 'react';
import { useNoteTree } from '../../../context/NoteTreeContext';
import { X, Check, BookOpen, Loader2, ChevronRight } from 'lucide-react';
import client from '../../../api/client';

const QuizConfigModal = ({ isOpen, onClose, courseId, currentNoteId, onGenerated }) => {
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

  if (!isOpen) return null;

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

  const handleGenerate = async () => {
    // ... 기존 로직 유지
    setLoading(true);
    const counts = {};
    Object.keys(activeTypes).forEach(type => {
      if (activeTypes[type]) counts[type] = typeCounts[type];
    });

    try {
      const response = await client.post('/quiz/generate', {
        noteIds: selectedIds,
        typeCounts: counts,
        difficulty
      });
      onGenerated(response.data);
      onClose();
    } catch (error) {
      alert('문제 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <BookOpen size={16} className="text-blue-600" /> AI 문제 생성 설정
          </h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">범위 선택</label>
            <div className="mt-2 space-y-1 border rounded-xl p-3 bg-slate-50/50">
              {(() => {
                const renderNote = (note, level = 0) => {
                  const hasChildren = note.children && note.children.length > 0;
                  const isExpanded = expandedIds.includes(note.noteId);

                  return (
                    <React.Fragment key={note.noteId}>
                      <div 
                        className="flex items-center gap-1 hover:bg-white rounded-lg cursor-pointer transition-colors group"
                        style={{ paddingLeft: `${level * 16 + 4}px` }}
                      >
                        <div 
                          onClick={(e) => hasChildren && toggleExpand(e, note.noteId)}
                          className={`p-1 rounded hover:bg-slate-200 transition-colors ${!hasChildren ? 'invisible' : ''}`}
                        >
                          <ChevronRight 
                            size={14} 
                            className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                          />
                        </div>
                        <label className="flex flex-1 items-center gap-2 py-1.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all"
                            checked={selectedIds.includes(note.noteId)} 
                            onChange={() => toggleNote(note.noteId)} 
                          />
                          <span className={`flex-1 truncate text-xs ${selectedIds.includes(note.noteId) ? 'font-bold text-slate-900' : 'text-slate-600 group-hover:text-slate-900'}`}>
                            {note.title || '제목 없는 노트'}
                          </span>
                        </label>
                      </div>
                      {hasChildren && isExpanded && (
                        <div className="overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                          {note.children.map(child => renderNote(child, level + 1))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                };
                return noteTree.map(note => renderNote(note));
              })()}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">문제 유형 및 문항 수</label>
            <div className="mt-2 space-y-2">
              {Object.keys(activeTypes).map(type => (
                <div key={type} className="flex items-center gap-2">
                  <input type="checkbox" checked={activeTypes[type]} onChange={() => setActiveTypes({...activeTypes, [type]: !activeTypes[type]})} />
                  <span className="text-xs flex-1">{type === 'MULTIPLE_CHOICE' ? '객관식' : type === 'OX' ? 'OX 퀴즈' : '주관식'}</span>
                  <input type="number" className="border rounded-lg text-xs p-1 w-16" value={typeCounts[type]} onChange={(e) => setTypeCounts({...typeCounts, [type]: parseInt(e.target.value)})} disabled={!activeTypes[type]} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">난이도</label>
            <select className="w-full mt-1 border rounded-lg text-xs p-2" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="EASY">하 (기초)</option>
              <option value="NORMAL">중 (보통)</option>
              <option value="HARD">상 (심화)</option>
              </select>
              </div>
              </div>
        <div className="p-5 border-t flex gap-3 bg-slate-50/50">
          <button 
            onClick={onClose} 
            className="flex-1 text-xs font-bold py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all"
          >
            취소
          </button>
          <button 
            onClick={handleGenerate} 
            disabled={loading || selectedIds.length === 0} 
            className="flex-[2] flex items-center justify-center gap-2 text-xs font-black py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all shadow-lg shadow-blue-100"
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
  );
};

export default QuizConfigModal;
