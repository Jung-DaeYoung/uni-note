import React, { useState, useEffect } from 'react';
import { X, Plus, BookOpen, Check, Loader2, Bookmark } from 'lucide-react';
import client from '../../../api/client';

const IncorrectNoteModal = ({ isOpen, onClose, questionId }) => {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
      setIsCreating(false);
      setNewTitle('');
      setSelectedGroupId(null);
    }
  }, [isOpen]);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const res = await client.get('/quiz/incorrect/groups');
      setGroups(res.data);
      if (res.data.length === 0) {
        setIsCreating(true);
      }
    } catch (err) {
      console.error("오답노트 목록 조회 실패:", err);
    } finally {
      setIsLoading(true); // 실제로는 false여야 함, 아래에서 수정
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (isCreating && !newTitle.trim()) {
      alert('노트 제목을 입력해주세요.');
      return;
    }
    if (!isCreating && !selectedGroupId) {
      alert('저장할 노트를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await client.post('/quiz/incorrect/add-to-group', {
        groupId: isCreating ? null : selectedGroupId,
        newGroupTitle: isCreating ? newTitle : null,
        questionId: questionId
      });
      alert('오답노트에 저장되었습니다.');
      onClose();
    } catch (err) {
      console.error("저장 실패:", err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Bookmark size={20} className="text-blue-600 dark:text-blue-400" />
              오답노트 담기
            </h2>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">문제를 분류하여 저장하세요.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 size={24} className="animate-spin text-blue-600 mx-auto" />
            </div>
          ) : isCreating ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 mb-2 block">새 오답노트 제목</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 알고리즘 중간고사 대비"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none text-sm font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                  autoFocus
                />
              </div>
              {groups.length > 0 && (
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  기존 노트에서 선택하기
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 dark:text-slate-500 mb-1 block">저장할 노트 선택</label>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                      selectedGroupId === group.id
                        ? 'border-blue-500 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                        : 'border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen size={16} className={selectedGroupId === group.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} />
                      <span className="text-sm font-bold">{group.title}</span>
                    </div>
                    {selectedGroupId === group.id && <Check size={16} />}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsCreating(true)}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-blue-300 dark:hover:border-blue-500/50 hover:text-blue-500 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-2 text-sm font-bold"
              >
                <Plus size={16} />
                새 오답노트 만들기
              </button>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-50 dark:border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-black rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            취소
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Bookmark size={14} />}
            {isCreating ? '생성 및 저장' : '이 노트에 담기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncorrectNoteModal;
