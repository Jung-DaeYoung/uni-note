import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  User, 
  LogOut, 
  PanelRightClose, 
  PanelRightOpen,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AppLayout = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-16' : 'w-[200px]'}`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="font-bold text-lg text-white">U</span>
          </div>
          {!isSidebarCollapsed && <span className="font-bold text-lg tracking-tight text-white">UniNote</span>}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-2">
          <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 p-3 rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <LayoutDashboard size={18} />
            {!isSidebarCollapsed && <span className="text-sm font-bold">대시보드</span>}
          </button>
        </nav>

        <div className="p-2 border-t border-slate-800">
          <button onClick={logout} className="w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-red-900/30 transition-colors text-slate-400 hover:text-red-400">
            <LogOut size={18} />
            {!isSidebarCollapsed && <span className="text-sm">로그아웃</span>}
          </button>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="w-full flex items-center gap-2 p-2.5 mt-1 rounded-lg hover:bg-slate-800 transition-colors text-slate-500">
            {isSidebarCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
            {!isSidebarCollapsed && <span className="text-sm">사이드바 접기</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            {/* 검색창 제거됨 */}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
