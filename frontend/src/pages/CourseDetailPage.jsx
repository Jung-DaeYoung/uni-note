import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  ChevronRight,
  FileText,
  Home,
  FolderOpen,
  BrainCircuit,
  Share2,
  PenLine,
  Trash2
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import NotionEditor from '../components/editor/NotionEditor';
import KeywordExplainPanel from '../components/editor/components/KeywordExplainPanel';
import { explanationParagraphs, insertKeywordExplanation } from '../components/editor/insertKeywordExplanation';
import QuizConfigModal from '../components/editor/components/QuizConfigModal';
import CBTPlayer from '../components/editor/components/CBTPlayer';
import { NoteTreeProvider } from '../context/NoteTreeContext';
import { useCourses } from '../context/CourseContext';
import { showAlert, useConfirm } from '../context/ConfirmContext';
import NoteTreeItem from '../components/course/NoteTreeItem';
import CourseBoardPanel from '../components/course/CourseBoardPanel';
import useCourseNotes from '../hooks/useCourseNotes';
import useCourseBoard from '../hooks/useCourseBoard';

const CourseDetailPage = () => {
  const { courseId, noteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { courses, renameCourse, deleteCourse } = useCourses();
  const confirm = useConfirm();

  const course = useMemo(() => courses.find(c => c.courseId === parseInt(courseId)), [courses, courseId]);
  const courseName = course ? course.courseName : '';
  // 직접 만든 강의에는 커뮤니티·노트 공유가 없고(서버도 막는다), 대신 이름 변경·삭제를 제공한다.
  const isUserCreated = Boolean(course?.userCreated);

  const handleRenameCourse = async () => {
    const name = await confirm({ title: '강의 이름 변경', variant: 'notice', confirmLabel: '저장', input: { defaultValue: courseName } });
    if (!name?.trim() || name.trim() === courseName) return;
    try {
      await renameCourse(course.courseId, name.trim());
    } catch (err) {
      showAlert(err.response?.data?.message || '강의 이름을 바꾸지 못했습니다.');
    }
  };

  const handleDeleteCourse = async () => {
    if (!(await confirm({
      title: `'${courseName}' 강의를 삭제할까요?`,
      message: '이 강의의 모든 노트와 하위 노트, 퀴즈·풀이 기록·오답노트 항목이 함께 영구 삭제됩니다.',
      confirmLabel: '강의 삭제',
    }))) return;
    try {
      await deleteCourse(course.courseId);
      navigate('/dashboard');
    } catch (err) {
      showAlert(err.response?.data?.message || '강의를 삭제하지 못했습니다.');
    }
  };

  const { noteTree, noteData, fetchTree, handleCreateRootNote, handleDeleteNote, handleShareNote } = useCourseNotes({
    courseId,
    noteId,
    navigate,
    searchParams: location.search,
  });

  // 강의 목록이 아직 없으면(첫 로딩) 강의 종류를 모르므로 게시판 조회를 미룬다.
  const board = useCourseBoard({ courseId, searchString: location.search, enabled: Boolean(course) && !isUserCreated });
  const { isBoardOpen, setIsBoardOpen, isBoardMaximized } = board;

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  // 키워드에서 연 문제 생성 범위({ noteId, blockId, keyword }). 일반 "AI 문제 생성"은 null이다.
  const [quizPreset, setQuizPreset] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [saveState, setSaveState] = useState({ status: 'synced', retry: () => {} });
  // 키워드 설명 패널 대상: { keyword, context, blockId, noteId, courseId }. 커뮤니티 패널과 동시에 열지 않는다.
  // 언급을 눌러 다른 노트로 이동해도 패널은 유지한다.
  const [keywordTarget, setKeywordTarget] = useState(null);
  // 오른쪽 패널은 넓은 화면(xl)에서만 노트 영역을 밀어내고, 좁은 화면에서는 노트 위에 겹쳐 뜬다.
  const isSidePanelOpen = isBoardOpen || keywordTarget !== null;

  // 키워드 설명을 넣을 편집기. NotionEditor가 onEditorReady로 알려 준다.
  const editorRef = useRef(null);
  const handleEditorReady = useCallback((editor) => { editorRef.current = editor; }, []);

  // 넣을 내용을 미리 보여 주고, 사용자가 "적용"을 고를 때만 노트를 바꾼다.
  const insertExplanation = async ({ text, label }) => {
    const explanation = { blockId: keywordTarget.blockId, keyword: keywordTarget.keyword, text, label };
    const ok = await confirm({
      title: '설명을 노트에 적용할까요?',
      message: `선택한 블록 바로 아래에 인용 블록으로 들어갑니다.\n\n${explanationParagraphs(explanation).join('\n')}`,
      variant: 'share',
      confirmLabel: '적용',
      cancelLabel: '적용 안 함',
    });
    const editor = editorRef.current;
    if (!ok || !editor || editor.isDestroyed) return false;
    return insertKeywordExplanation(editor, explanation);
  };

  const openKeywordQuiz = ({ noteId: presetNoteId, blockId, keyword }) => {
    setQuizPreset({ noteId: presetNoteId, blockId, keyword });
    setIsQuizModalOpen(true);
  };

  const openMention = (mention) => {
    navigate(`/course/${courseId}/note/${mention.noteId}`,
      mention.blockId ? { state: { sourceBlockId: mention.blockId } } : undefined);
  };

  // noteId가 바뀌면 이전 노트의 저장 상태가 새 노트 헤더에 잠깐이라도 남지 않도록
  // 렌더 중에 상태를 초기화한다(effect가 아닌 렌더 단계에서 처리하는 React 권장 패턴).
  const [savedForNoteId, setSavedForNoteId] = useState(noteId);
  if (noteId !== savedForNoteId) {
    setSavedForNoteId(noteId);
    setSaveState({ status: 'synced', retry: () => {} });
  }

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
            {!isUserCreated && (
            <button
              onClick={() => handleShareNote(noteData?.title || '제목 없음')}
              disabled={!noteData || saveState.status !== 'synced'}
              title={saveState.status !== 'synced' ? '저장이 끝난 뒤 공유할 수 있습니다' : '현재 노트와 하위 노트를 공유합니다'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Share2 size={12} />
              노트 공유
            </button>
            )}
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
        {isUserCreated ? (
          <>
            <button
              onClick={handleRenameCourse}
              title="강의 이름 변경"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <PenLine size={12} />
              이름 변경
            </button>
            <button
              onClick={handleDeleteCourse}
              title="강의 삭제"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={12} />
              강의 삭제
            </button>
          </>
        ) : (
        <button
          onClick={() => {
            setIsBoardOpen(!isBoardOpen);
            setKeywordTarget(null);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            isBoardOpen
            ? 'bg-slate-900 dark:bg-slate-700 text-white'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <MessageSquare size={12} />
          {isBoardOpen ? '닫기' : '커뮤니티'}
        </button>
        )}
      </div>
    </div>
  );

  return (
    <NoteTreeProvider noteTree={noteTree}>
      <QuizConfigModal
        isOpen={isQuizModalOpen}
        onClose={() => {
          setIsQuizModalOpen(false);
          setQuizPreset(null);
        }}
        preset={quizPreset}
        currentNoteId={noteId}
        courseId={courseId}
        onGenerated={(res) => setQuizResult(res)}
        saveStatus={saveState.status}
      />
      {quizResult && (
        <CBTPlayer quizData={quizResult} onClose={() => setQuizResult(null)} courseId={courseId} />
      )}
      <AppLayout sidebarContent={sidebarContent} headerContent={headerContent}>
        <div className="flex h-[calc(100vh-48px)] bg-slate-50 dark:bg-slate-950 overflow-hidden relative font-sans">
          {/* Left: Lecture Note Area */}
          <main className={`flex-1 overflow-y-auto transition-all duration-500 ease-in-out bg-white dark:bg-slate-950 ${isBoardOpen && isBoardMaximized ? 'opacity-0 invisible' : isSidePanelOpen ? 'xl:mr-[400px]' : 'mr-0'}`}>
            <div className={`mx-auto transition-all duration-500 pt-8 ${isSidePanelOpen ? 'max-w-4xl' : 'max-w-7xl'}`}>
              <div className="px-8 pb-10">
                {noteId && noteData && noteData.noteId === parseInt(noteId) ? (
                  <NotionEditor key={noteId} noteId={noteId} courseId={courseId} initialData={noteData} onSaved={fetchTree} onSaveStateChange={setSaveState}
                    onKeywordSelect={(selection) => {
                      setKeywordTarget({ ...selection, noteId: Number(noteId), courseId: Number(courseId) });
                      setIsBoardOpen(false);
                    }}
                    onKeywordQuiz={(selection) => openKeywordQuiz({ ...selection, noteId: Number(noteId) })}
                    onEditorReady={handleEditorReady}
                  />
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
          {keywordTarget && (
            <KeywordExplainPanel
              key={keywordTarget.keyword}
              target={keywordTarget}
              onClose={() => setKeywordTarget(null)}
              onSelectKeyword={(keyword) => setKeywordTarget(prev => ({ ...prev, keyword }))}
              onOpenMention={openMention}
              onMakeQuiz={openKeywordQuiz}
              canInsert={keywordTarget.noteId === Number(noteId)}
              onInsert={insertExplanation}
            />
          )}
        </div>
      </AppLayout>
    </NoteTreeProvider>
  );
};

export default CourseDetailPage;
