import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  LogOut, 
  Menu,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  BookOpen,
  PenLine
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCourses } from '../../context/CourseContext';

const AppLayout = ({ children, sidebarContent, headerContent }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { courses } = useCourses();

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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside 
        className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isSidebarCollapsed ? 'w-0' : 'w-64 border-r border-slate-800'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-12 flex items-center px-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
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
              className={`w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-all whitespace-nowrap cursor-pointer ${
                location.pathname === '/dashboard' ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white'
              }`}
              onClick={handleDashboardClick}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} />
                <span className="text-sm font-bold">대시보드</span>
              </div>
              <button 
                onClick={toggleDashboard}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                {isDashboardExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>

            {/* Course List (Nested) */}
            {isDashboardExpanded && (
              <div className="mt-1 ml-4 space-y-1 border-l border-slate-800">
                {courses.length === 0 ? (
                  <p className="px-6 py-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">수강 중인 강의 없음</p>
                ) : (
                  courses.map((course) => {
                    const isCourseActive = location.pathname.includes(`/course/${course.courseId}`);
                    return (
                      <div key={course.courseId} className="space-y-0.5">
                        <button 
                          onClick={() => navigate(`/course/${course.courseId}`)}
                          className={`w-[calc(100%-0.5rem)] ml-2 flex items-center gap-3 p-2.5 rounded-xl transition-all text-xs font-bold ${
                            isCourseActive 
                            ? 'bg-blue-600/10 text-blue-400' 
                            : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                          }`}
                        >
                          <BookOpen size={14} className={isCourseActive ? 'text-blue-400' : 'text-slate-500'} />
                          <span className="truncate">{course.courseName}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <button 
            onClick={() => navigate('/quizzes')} 
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all whitespace-nowrap mb-2 ${
              location.pathname === '/quizzes' ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BrainCircuit size={18} />
            <span className="text-sm font-bold">생성 문제 모음</span>
          </button>

          <div className="h-[1px] bg-slate-800 my-4 mx-2" />

          {sidebarContent}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button 
            onClick={logout} 
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all whitespace-nowrap"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <header className="h-12 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center px-4 sticky top-0 z-50 shrink-0">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-all text-slate-500 hover:text-slate-900 active:scale-95"
            title={isSidebarCollapsed ? "사이드바 열기" : "사이드바 접기"}
          >
            <Menu size={20} />
          </button>
          
          <div className="ml-4 flex-1 flex items-center h-full overflow-hidden">
            {headerContent}
          </div>
        </header>

        <div className="p-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
