import React, { useState, useEffect, useId } from 'react';
import useModalDialog from '../../../hooks/useModalDialog';
import { X, Plus, Check, Loader2 } from 'lucide-react';
import client from '../../../api/client';
import { showAlert } from '../../../context/ConfirmContext';
import '../../../pages/QuizLibraryPage.css';
import './QuizAttemptsModal.css';
import './IncorrectNoteModal.css';

const IncorrectNoteModal = ({ isOpen, onClose, questionId }) => {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const titleId = useId();
  const dialogRef = useModalDialog(isOpen, onClose);

  // 모달이 열릴 때 서버 목록을 새로 불러오는 표준 fetch-on-open 패턴이다.
  useEffect(() => {
    if (!isOpen) return;
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
        setIsLoading(false);
      }
    };
    fetchGroups();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCreating(false);
    setNewTitle('');
    setSelectedGroupId(null);
  }, [isOpen]);

  const handleSave = async () => {
    if (isSaving) return;
    if (isCreating && !newTitle.trim()) {
      showAlert('노트 제목을 입력해주세요.');
      return;
    }
    if (!isCreating && !selectedGroupId) {
      showAlert('저장할 노트를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await client.post('/quiz/incorrect/add-to-group', {
        groupId: isCreating ? null : selectedGroupId,
        newGroupTitle: isCreating ? newTitle : null,
        questionId: questionId
      });
      showAlert('오답노트에 저장되었습니다.');
      onClose();
    } catch (err) {
      console.error("저장 실패:", err);
      showAlert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="att-overlay inm-overlay">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="att outline-none"
      >
        <div className="att-head">
          <h2 id={titleId} className="cf-title">오답노트 담기</h2>
          <button onClick={onClose} aria-label="닫기" className="lib-icon cf-close">
            <X size={18} />
          </button>
        </div>

        <div className="att-body inm-body">
          {isLoading ? (
            <p className="lib-loading">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              오답노트 목록을 불러오는 중입니다.
            </p>
          ) : isCreating ? (
            <div className="inm-create">
              <label htmlFor="incorrect-note-title" className="inm-label">새 오답노트 제목</label>
              <input
                id="incorrect-note-title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 알고리즘 중간고사 대비"
                className="cf-input inm-input"
                autoFocus
              />
              {groups.length > 0 && (
                <button onClick={() => setIsCreating(false)} className="inm-link">
                  기존 노트에서 선택하기
                </button>
              )}
            </div>
          ) : (
            <>
              <p id="incorrect-note-groups" className="inm-label">저장할 노트 선택</p>
              <ul role="group" aria-labelledby="incorrect-note-groups" className="lib-list inm-groups">
                {groups.map(group => (
                  <li key={group.id}>
                    <button
                      onClick={() => setSelectedGroupId(group.id)}
                      aria-pressed={selectedGroupId === group.id}
                      className="inm-group"
                    >
                      <span className="inm-group-title">{group.title}</span>
                      {selectedGroupId === group.id && <Check size={16} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
              <button onClick={() => setIsCreating(true)} className="lib-btn inm-new">
                <Plus size={16} aria-hidden="true" />
                새 오답노트 만들기
              </button>
            </>
          )}
        </div>

        <div className="att-foot inm-foot">
          <button onClick={onClose} className="lib-btn">취소</button>
          <button onClick={handleSave} disabled={isSaving} className="lib-btn lib-btn-primary inm-save">
            {isSaving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {isCreating ? '생성 및 저장' : '이 노트에 담기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncorrectNoteModal;
