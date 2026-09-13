import React, { useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  ChevronRight,
  FileText,
  Home,
  FolderOpen
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import NotionEditor from '../components/editor/NotionEditor';
import { NoteTreeProvider } from '../context/NoteTreeContext';
import { useCourses } from '../context/CourseContext';
import NoteTreeItem from '../components/course/NoteTreeItem';
import CourseBoardPanel from '../components/course/CourseBoardPanel';
import useCourseNotes from '../hooks/useCourseNotes';
import useCourseBoard from '../hooks/useCourseBoard';

const CourseDetailPage = () => {
  const { courseId, noteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { courses } = useCourses();

  const courseName = useMemo(() => {
    const course = courses.find(c => c.courseId === parseInt(courseId));
    return course ? course.courseName : '';
  }, [courses, courseId]);

  const { noteTree, noteData, fetchTree, handleCreateRootNote, handleDeleteNote } = useCourseNotes({
    courseId,
    noteId,
    navigate,
    searchParams: location.search,
  });

  const board = useCourseBoard({ courseId, searchString: location.search });
  const { isBoardOpen, setIsBoardOpen, isBoardMaximized } = board;

  // --- Sidebar Content ---
  const sidebarContent = useMemo(() => (
    <div className="flex flex-col h-full">
      <div className="px-2 mb-4 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Notes</span>
        <button
          onClick={handleCreateRootNote}
          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
          title="새 노트 추가"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-0.5">
        {noteTree.map(item => (
          <NoteTreeItem
            key={item.noteId}
            item={item}
            courseId={courseId}
            currentNoteId={noteId}
            onDelete={handleDeleteNote}
          />
        ))}
      </div>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [noteTree, courseId, noteId]);

  // --- Unified Header Content ---
  const headerContent = useMemo(() => (
    <div className="flex items-center justify-between w-full pr-4 h-full">
      <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        <Link to="/dashboard" className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-900 transition-colors">
          <Home size={14} />
        </Link>
        <ChevronRight size={10} className="text-slate-300 shrink-0" />
        <div className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
          <FolderOpen size={12} className="text-blue-500" />
          <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">{courseName}</span>
        </div>

        {noteData?.breadcrumbs?.map((bc) => (
          <React.Fragment key={bc.noteId}>
            <ChevronRight size={10} className="text-slate-300 shrink-0" />
            <Link
              to={`/course/${courseId}/note/${bc.noteId}`}
              className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors truncate max-w-[120px]"
            >
              {bc.title}
            </Link>
          </React.Fragment>
        ))}

        {noteData && (
          <>
            <ChevronRight size={10} className="text-slate-300 shrink-0" />
            <span className="text-xs font-black text-slate-900 truncate max-w-[180px]">
              {noteData.title || '제목 없음'}
            </span>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <button
          onClick={() => setIsBoardOpen(!isBoardOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
            isBoardOpen
            ? 'bg-slate-900 text-white shadow-inner'
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <MessageSquare size={12} />
          {isBoardOpen ? '닫기' : '커뮤니티'}
        </button>
      </div>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [courseId, courseName, noteData, isBoardOpen]);

  return (
    <NoteTreeProvider noteTree={noteTree}>
      <AppLayout sidebarContent={sidebarContent} headerContent={headerContent}>
        <div className="flex h-[calc(100vh-48px)] bg-slate-50 overflow-hidden relative font-sans">
          {/* Left: Lecture Note Area */}
          <main className={`flex-1 overflow-y-auto transition-all duration-500 ease-in-out bg-white ${isBoardOpen ? (isBoardMaximized ? 'opacity-0 invisible' : 'mr-[400px]') : 'mr-0'}`}>
            <div className={`mx-auto transition-all duration-500 pt-8 ${isBoardOpen ? 'max-w-4xl' : 'max-w-7xl'}`}>
              <div className="px-8 pb-10">
                {noteId && noteData && noteData.noteId === parseInt(noteId) ? (
                  <NotionEditor key={noteId} noteId={noteId} courseId={courseId} initialData={noteData} onSaved={() => fetchTree()} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-40 opacity-20">
                    <FileText size={64} className="mb-4" />
                    <p className="font-black uppercase tracking-widest">노트를 불러오는 중...</p>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Right Sidebar (Community) */}
          <CourseBoardPanel {...board} />
        </div>
      </AppLayout>
    </NoteTreeProvider>
  );
};

export default CourseDetailPage;
