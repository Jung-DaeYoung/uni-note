import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const NoteTreeItem = ({ item, courseId, currentNoteId, onDelete }) => {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const hasChildren = item.children && item.children.length > 0;
  const isActive = parseInt(currentNoteId) === item.noteId;
  const title = item.title || '제목 없음';

  return (
    <div className="select-none">
      <div className={`side-note ${isActive ? 'side-note-active' : ''}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? '하위 노트 접기' : '하위 노트 펼치기'}
          className={`side-note-toggle ${!hasChildren ? 'side-note-hidden' : ''}`}
        >
          <ChevronRight size={14} />
        </button>
        <button
          onClick={() => navigate(`/course/${courseId}/note/${item.noteId}`)}
          aria-current={isActive ? 'page' : undefined}
          title={title}
          className="side-note-title"
        >
          {title}
        </button>
        <button
          onClick={() => onDelete(item.noteId, item.title)}
          title="노트 삭제"
          aria-label="노트 삭제"
          className="side-note-delete"
        >
          삭제
        </button>
      </div>

      {isOpen && hasChildren && (
        <div className="side-notes-children">
          {item.children.map(child => (
            <NoteTreeItem
              key={child.noteId}
              item={child}
              courseId={courseId}
              currentNoteId={currentNoteId}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NoteTreeItem;
