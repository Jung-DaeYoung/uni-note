import React, { useState } from 'react';
import { useNoteTree } from '../../../context/NoteTreeContext';
import { X, Check, BookOpen, Loader2 } from 'lucide-react';
import client from '../../../api/client';

const QuizConfigModal = ({ isOpen, onClose, courseId, currentNoteId, onGenerated }) => {
  const { noteTree } = useNoteTree();
  const [selectedIds, setSelectedIds] = useState([parseInt(currentNoteId)]);
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
    setSelectedIds(prev => 
      prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
    );
  };

  const handleGenerate = async () => {
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

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">범위 선택</label>
            <div className="mt-2 space-y-1 border rounded-lg p-2 bg-slate-50">
              {noteTree.map(note => (
                <label key={note.noteId} className="flex items-center gap-2 text-xs p-1 hover:bg-white rounded cursor-pointer">
                  <input type="checkbox" checked={selectedIds.includes(note.noteId)} onChange={() => toggleNote(note.noteId)} />
                  {note.title}
                </label>
              ))}
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
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 text-xs font-bold py-2 rounded-lg bg-slate-100">취소</button>
          <button onClick={handleGenerate} disabled={loading || selectedIds.length === 0} className="flex-1 text-xs font-bold py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} 생성 시작
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizConfigModal;
