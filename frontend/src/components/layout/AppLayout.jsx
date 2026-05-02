import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  LogOut, 
  Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AppLayout = ({ children, sidebarContent, headerContent }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside 
        className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isSidebarCollapsed ? 'w-0' : 'w-60 border-r border-slate-800'
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
          <button 
            onClick={() => navigate('/dashboard')} 
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all whitespace-nowrap mb-2"
          >
            <LayoutDashboard size={18} />
            <span className="text-sm font-bold">대시보드</span>
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
          
          <div className="ml-4 flex-1 flex items-center h-full">
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
