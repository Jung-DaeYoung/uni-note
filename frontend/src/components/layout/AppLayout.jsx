import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  BrainCircuit,
  BarChart3,
  ChevronDown,
  ChevronRight,
  BookOpen,
  PenLine,
  Share2,
  FileText,
  Plus,
  Moon,
  Sun
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourses } from '../../context/CourseContext';
import { useTheme } from '../../context/ThemeContext';

const AppLayout = ({ children, sidebarContent, headerContent }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { courses, createCourse } = useCourses();
  const { theme, toggleTheme } = useTheme();
  const enrolledCourses = courses.filter(c => !c.userCreated);
  const myCourses = courses.filter(c => c.userCreated);
  // VS Code 새 파일처럼 "내가 만든 강의" 목록 안에 이름 입력칸을 띄운다. null이면 입력칸을 숨긴다.
  const [newCourseName, setNewCourseName] = useState(null);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

  // Enter·포커스 이탈 모두 여기로 온다. 비어 있으면 취소하고, Enter 뒤에 이어지는 blur로
  // 두 번 만들어지지 않도록 진행 중이면 무시한다. 실패하면 입력칸을 남겨 이름을 고칠 수 있게 한다.
  const submitNewCourse = async () => {
    if (newCourseName === null || isCreatingCourse) return;
    const name = newCourseName.trim();
    if (!name) {
      setNewCourseName(null);
      return;
    }
    setIsCreatingCourse(true);
    try {
      const course = await createCourse(name);
      setNewCourseName(null);
      navigate(`/course/${course.courseId}`);
    } catch (err) {
      alert(err.response?.data?.message || '강의를 만들지 못했습니다.');
    } finally {
      setIsCreatingCourse(false);
    }
  };

  const renderCourse = (course) => {
    // '/course/1'이 '/course/10'에도 걸리지 않도록 경로 구분자까지 비교한다.
    const isCourseActive = `${location.pathname}/`.startsWith(`/course/${course.courseId}/`);
    const Icon = course.userCreated ? PenLine : BookOpen;
    return (
      <button
        key={course.courseId}
        onClick={() => navigate(`/course/${course.courseId}`)}
        className={`w-[calc(100%-0.5rem)] ml-2 flex items-center gap-3 p-2.5 rounded-lg transition-colors text-xs font-bold ${
          isCourseActive
          ? 'bg-blue-600/10 text-blue-400'
          : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        <Icon size={14} className={isCourseActive ? 'text-blue-400' : 'text-slate-500'} />
        <span className="truncate">{course.courseName}</span>
      </button>
    );
  };

  const toggleDashboard = (e) => {
    e.stopPropagation();
    setIsDashboardExpanded(!isDashboardExpanded);
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
    if (!isDashboardExpanded) {
      setIsDashboardExpanded(true);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <aside 
        className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isSidebarCollapsed ? 'w-0' : 'w-64 border-r border-slate-800'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-12 flex items-center px-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center shrink-0">
              <span className="font-black text-sm text-white">U</span>
            </div>
            <span className="font-bold text-base tracking-tight text-white whitespace-nowrap">UniNote</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Dashboard Menu (Collapsible) */}
          <div className="mb-2">
            <div
              className={`w-full flex items-center justify-between py-2.5 pl-2.5 pr-2.5 border-l-2 rounded-r-lg transition-colors whitespace-nowrap cursor-pointer ${
                location.pathname === '/dashboard' ? 'border-blue-500 bg-blue-500/5 text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              onClick={handleDashboardClick}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} />
                <span className="text-sm font-bold">강의목록</span>
              </div>
              <button 
                onClick={toggleDashboard}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                {isDashboardExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>

            {/* Course List (Nested): 수강 중인 강의 / 내가 만든 강의 */}
            {isDashboardExpanded && (
              <div className="mt-1 ml-4 space-y-1 border-l border-slate-800">
                <p className="px-4 pt-1 pb-1 text-[10px] font-bold text-slate-600">수강 중인 강의</p>
                {enrolledCourses.length === 0 ? (
                  <p className="px-6 py-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">수강 중인 강의 없음</p>
                ) : (
                  enrolledCourses.map(renderCourse)
                )}

                <div className="flex items-center justify-between pl-4 pr-2 pt-3 pb-1">
                  <p className="text-[10px] font-bold text-slate-600">내가 만든 강의</p>
                  <button
                    onClick={() => setNewCourseName('')}
                    title="새 강의 만들기"
                    aria-label="새 강의 만들기"
                    className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-white transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {myCourses.map(renderCourse)}
                {newCourseName !== null && (
                  <div className="w-[calc(100%-0.5rem)] ml-2 flex items-center gap-3 p-2 rounded-lg bg-white/5">
                    <PenLine size={14} className="text-slate-500 shrink-0" />
                    <input
                      autoFocus
                      value={newCourseName}
                      maxLength={100}
                      placeholder="강의 이름"
                      aria-label="새 강의 이름"
                      disabled={isCreatingCourse}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      onKeyDown={(e) => {
                        // 한글 IME 조합 중 Enter는 조합 확정용이라 제출하지 않는다(마지막 글자 유실·중복 방지).
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === 'Enter') submitNewCourse();
                        if (e.key === 'Escape') setNewCourseName(null);
                      }}
                      onBlur={submitNewCourse}
                      className="flex-1 min-w-0 bg-transparent border-b border-blue-500 text-xs font-bold text-slate-100 placeholder:text-slate-600 outline-none py-0.5"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/quizzes')}
            className={`w-full flex items-center gap-3 py-2.5 pl-2.5 pr-2.5 border-l-2 rounded-r-lg transition-colors whitespace-nowrap mb-2 ${
              location.pathname === '/quizzes' ? 'border-blue-500 bg-blue-500/5 text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BrainCircuit size={18} />
            <span className="text-sm font-bold">나의 CBT 시험</span>
          </button>

          <button
            onClick={() => navigate('/shared-quizzes')}
            className={`w-full flex items-center gap-3 py-2.5 pl-2.5 pr-2.5 border-l-2 rounded-r-lg transition-colors whitespace-nowrap mb-2 ${
              location.pathname === '/shared-quizzes' ? 'border-blue-500 bg-blue-500/5 text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Share2 size={18} />
            <span className="text-sm font-bold">CBT 시험 공유게시판</span>
          </button>

          <button
            onClick={() => navigate('/shared-notes')}
            className={`w-full flex items-center gap-3 py-2.5 pl-2.5 pr-2.5 border-l-2 rounded-r-lg transition-colors whitespace-nowrap mb-2 ${
              location.pathname.startsWith('/shared-notes') ? 'border-blue-500 bg-blue-500/5 text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText size={18} />
            <span className="text-sm font-bold">노트 공유 게시판</span>
          </button>

          <button
            onClick={() => navigate('/incorrect-notes')}
            className={`w-full flex items-center gap-3 py-2.5 pl-2.5 pr-2.5 border-l-2 rounded-r-lg transition-colors whitespace-nowrap mb-2 ${
              location.pathname.startsWith('/incorrect-notes') ? 'border-blue-500 bg-blue-500/5 text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 size={18} />
            <span className="text-sm font-bold">오답노트</span>
          </button>

          <div className="h-[1px] bg-slate-800 my-4 mx-2" />

          {sidebarContent}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors whitespace-nowrap"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <header className="h-12 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 flex items-center px-4 sticky top-0 z-50 shrink-0">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 active:scale-95"
            title={isSidebarCollapsed ? "사이드바 열기" : "사이드바 접기"}
          >
            <Menu size={20} />
          </button>

          <div className="ml-4 flex-1 flex items-center h-full overflow-hidden">
            {headerContent}
          </div>

          <button
            onClick={toggleTheme}
            className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 active:scale-95 shrink-0"
            title={theme === 'dark' ? '라이트 모드로 전환' : '야간 모드로 전환'}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '야간 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <div className="p-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
