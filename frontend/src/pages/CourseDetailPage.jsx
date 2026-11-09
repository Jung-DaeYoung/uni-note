import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ChevronRight,
  Home,
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
import './QuizLibraryPage.css';
import './CourseDetailPage.css';

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
      <div className="side-group-head">
        <p className="side-group-label">노트</p>
        <button
          onClick={handleCreateRootNote}
          className="side-add"
          title="새 노트 추가"
          aria-label="새 노트 추가"
        >
          추가
        </button>
      </div>
      <div>
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
    <div className="note-header flex items-center justify-between w-full pr-4 h-full">
      <nav aria-label="노트 경로" className="note-crumbs no-scrollbar">
        <Link to="/dashboard" className="note-crumb note-crumb-home" aria-label="강의목록">
          <Home size={14} aria-hidden="true" />
        </Link>
        <ChevronRight size={10} className="note-crumb-sep" aria-hidden="true" />
        <span className="note-crumb-course">{courseName}</span>

        {noteData?.breadcrumbs?.map((bc) => (
          <React.Fragment key={bc.noteId}>
            <ChevronRight size={10} className="note-crumb-sep" aria-hidden="true" />
            <Link to={`/course/${courseId}/note/${bc.noteId}`} className="note-crumb">
              {bc.title}
            </Link>
          </React.Fragment>
        ))}

        {noteData && (
          <>
            <ChevronRight size={10} className="note-crumb-sep" aria-hidden="true" />
            <span aria-current="page" className="note-crumb-current">
              {noteData.title || '제목 없음'}
            </span>
          </>
        )}
      </nav>

      <div className="note-actions">
        {noteId && (
          <div className={`note-status ${saveState.status === 'error' ? 'note-status-error' : ''}`}>
            <span className={`note-status-dot ${saveState.status === 'saving' ? 'note-status-dot-saving animate-pulse motion-reduce:animate-none' : ''}`} />
            <span role="status" className="note-status-text">
              {saveState.status === 'saving' ? '저장 중...' : saveState.status === 'error' ? '오류' : '저장됨'}
            </span>
            {saveState.status === 'error' && (
              <button onClick={saveState.retry} className="note-retry">
                재시도
              </button>
            )}
          </div>
        )}
        <div role="group" aria-label="노트 작업" className="note-tools">
          {noteId && (
            <button
              onClick={() => setIsQuizModalOpen(true)}
              className="lib-btn lib-btn-primary note-tool"
            >
              <span className="note-tool-extra">AI </span>문제 생성
            </button>
          )}
          {noteId && !isUserCreated && (
            <button
              onClick={() => handleShareNote(noteData?.title || '제목 없음')}
              disabled={!noteData || saveState.status !== 'synced'}
              title={saveState.status !== 'synced' ? '저장이 끝난 뒤 공유할 수 있습니다' : '현재 노트와 하위 노트를 공유합니다'}
              className="lib-btn note-tool"
            >
              <span className="note-tool-extra">노트 </span>공유
            </button>
          )}
          {isUserCreated ? (
            <>
              <button
                onClick={handleRenameCourse}
                title="강의 이름 변경"
                className="lib-btn note-tool note-tool-icon"
              >
                <PenLine size={14} aria-hidden="true" />
                <span className="note-tool-label">이름 변경</span>
              </button>
              <button
                onClick={handleDeleteCourse}
                title="강의 삭제"
                className="lib-btn note-tool note-tool-icon note-tool-danger"
              >
                <Trash2 size={14} aria-hidden="true" />
                <span className="note-tool-label">강의 삭제</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setIsBoardOpen(!isBoardOpen);
                setKeywordTarget(null);
              }}
              aria-expanded={isBoardOpen}
              className={`lib-btn note-tool ${isBoardOpen ? 'note-tool-open' : ''}`}
            >
              커뮤니티
            </button>
          )}
        </div>
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
        <div className="flex h-[calc(100dvh-48px)] bg-slate-50 dark:bg-slate-950 overflow-hidden relative font-sans">
          {/* Left: Lecture Note Area */}
          <main className={`flex-1 overflow-y-auto bg-white dark:bg-slate-950 ${isBoardOpen && isBoardMaximized ? 'opacity-0 invisible' : isSidePanelOpen ? 'xl:mr-[400px]' : 'mr-0'}`}>
            <div className={`mx-auto pt-4 md:pt-8 ${isSidePanelOpen ? 'max-w-4xl' : 'max-w-7xl'}`}>
              <div className="px-3 pb-10 md:px-8">
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
                  <p role="status" className="note-loading">노트를 불러오는 중...</p>
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
