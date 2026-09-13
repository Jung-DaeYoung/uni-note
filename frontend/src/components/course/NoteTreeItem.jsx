import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, FolderOpen, Trash2 } from 'lucide-react';

const NoteTreeItem = ({ item, courseId, depth = 0, currentNoteId, onDelete }) => {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const hasChildren = item.children && item.children.length > 0;
  const isActive = parseInt(currentNoteId) === item.noteId;

  return (
    <div className="select-none">
      <div
        className={`group flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-200 ${
          isActive
          ? 'bg-blue-600 shadow-lg shadow-blue-500/20 text-white'
          : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
        }`}
        style={{ marginLeft: `${depth * 12}px` }}
        onClick={() => navigate(`/course/${courseId}/note/${item.noteId}`)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`p-0.5 rounded hover:bg-white/10 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} ${!hasChildren ? 'invisible' : ''}`}
        >
          <ChevronRight size={14} />
        </button>
        {hasChildren ? (
          <FolderOpen size={14} className={isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-blue-400'} />
        ) : (
          <FileText size={14} className={isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-300'} />
        )}
        <span className={`text-[11px] font-bold truncate flex-1 ${isActive ? 'text-white' : ''}`}>
          {item.title || '제목 없음'}
        </span>

        {/* Delete Button (Visible on Hover) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.noteId, item.title);
          }}
          className={`p-1 rounded hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 ${isActive ? 'text-blue-200' : 'text-slate-500'}`}
          title="노트 삭제"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {isOpen && hasChildren && (
        <div className="mt-0.5 border-l border-slate-800/50 ml-3">
          {item.children.map(child => (
            <NoteTreeItem
              key={child.noteId}
              item={child}
              courseId={courseId}
              depth={depth}
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
