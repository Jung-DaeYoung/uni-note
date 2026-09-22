import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  ChevronRight,
  FileText,
  Home,
  FolderOpen,
  BrainCircuit
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import NotionEditor from '../components/editor/NotionEditor';
import QuizConfigModal from '../components/editor/components/QuizConfigModal';
import CBTPlayer from '../components/editor/components/CBTPlayer';
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

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [saveState, setSaveState] = useState({ status: 'synced', retry: () => {} });

  // noteId가 바뀌면 이전 노트의 저장 상태가 새 노트 헤더에 잠깐이라도 남지 않도록
  // 렌더 중에 상태를 초기화한다(effect가 아닌 렌더 단계에서 처리하는 React 권장 패턴).
  const [savedForNoteId, setSavedForNoteId] = useState(noteId);
  if (noteId !== savedForNoteId) {
    setSavedForNoteId(noteId);
    setSaveState({ status: 'synced', retry: () => {} });
  }

  const handleSaveStateChange = useCallback((state) => setSaveState(state), []);
  const handleNoteSaved = useCallback(() => fetchTree(), [fetchTree]);

  // --- Sidebar Content ---
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-2 mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 px-2">노트</span>
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
  );

  // --- Unified Header Content ---
  const headerContent = (
    <div className="flex items-center justify-between w-full pr-4 h-full">
      <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        <Link to="/dashboard" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          <Home size={14} />
        </Link>
        <ChevronRight size={10} className="text-slate-300 dark:text-slate-600 shrink-0" />
        <div className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700">
          <FolderOpen size={12} className="text-blue-500 dark:text-blue-400" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{courseName}</span>
        </div>

        {noteData?.breadcrumbs?.map((bc) => (
          <React.Fragment key={bc.noteId}>
            <ChevronRight size={10} className="text-slate-300 dark:text-slate-600 shrink-0" />
            <Link
              to={`/course/${courseId}/note/${bc.noteId}`}
              className="text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[120px]"
            >
              {bc.title}
            </Link>
          </React.Fragment>
        ))}

        {noteData && (
          <>
            <ChevronRight size={10} className="text-slate-300 dark:text-slate-600 shrink-0" />
            <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
              {noteData.title || '제목 없음'}
            </span>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        {noteId && (
          <>
            <button
              onClick={() => setIsQuizModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
            >
              <BrainCircuit size={12} />
              AI 문제 생성
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className={`w-1.5 h-1.5 rounded-full ${saveState.status === 'saving' ? 'bg-blue-500 animate-pulse' : saveState.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {saveState.status === 'saving' ? '저장 중...' : saveState.status === 'error' ? '오류' : '저장됨'}
              </span>
              {saveState.status === 'error' && (
                <button
                  onClick={saveState.retry}
                  className="text-xs font-medium text-red-600 dark:text-red-400 underline hover:text-red-700 dark:hover:text-red-300"
                >
                  재시도
                </button>
              )}
            </div>
          </>
        )}
        <button
          onClick={() => setIsBoardOpen(!isBoardOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            isBoardOpen
            ? 'bg-slate-900 dark:bg-slate-700 text-white'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <MessageSquare size={12} />
          {isBoardOpen ? '닫기' : '커뮤니티'}
        </button>
      </div>
    </div>
  );

  return (
    <NoteTreeProvider noteTree={noteTree}>
      <QuizConfigModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        courseId={courseId}
        currentNoteId={noteId}
        onGenerated={(res) => setQuizResult(res)}
      />
      {quizResult && (
        <CBTPlayer quizData={quizResult} onClose={() => setQuizResult(null)} courseId={courseId} />
      )}
      <AppLayout sidebarContent={sidebarContent} headerContent={headerContent}>
        <div className="flex h-[calc(100vh-48px)] bg-slate-50 dark:bg-slate-950 overflow-hidden relative font-sans">
          {/* Left: Lecture Note Area */}
          <main className={`flex-1 overflow-y-auto transition-all duration-500 ease-in-out bg-white dark:bg-slate-950 ${isBoardOpen ? (isBoardMaximized ? 'opacity-0 invisible' : 'mr-[400px]') : 'mr-0'}`}>
            <div className={`mx-auto transition-all duration-500 pt-8 ${isBoardOpen ? 'max-w-4xl' : 'max-w-7xl'}`}>
              <div className="px-8 pb-10">
                {noteId && noteData && noteData.noteId === parseInt(noteId) ? (
                  <NotionEditor key={noteId} noteId={noteId} courseId={courseId} initialData={noteData} onSaved={handleNoteSaved} onSaveStateChange={handleSaveStateChange} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-40 opacity-20 text-slate-900 dark:text-slate-100">
                    <FileText size={64} className="mb-4" />
                    <p className="font-medium">노트를 불러오는 중...</p>
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
