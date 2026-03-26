import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Settings, Layers, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CompanySettingsModal } from '../ui/CompanySettingsModal';

export function Sidebar({ isCollapsed = false, setIsCollapsed = () => {} }: { isCollapsed?: boolean; setIsCollapsed?: (val: boolean) => void }) {
  const { logout, profile } = useAuth();
  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/create', icon: PlusCircle, label: 'Create Tech Pack' },
  ];

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <aside className={`h-screen shrink-0 border-r border-gray-200 bg-white flex flex-col p-4 fixed left-0 top-0 z-30 transition-all duration-300 ${isCollapsed ? 'w-20 items-center' : 'w-64'}`}>
      <div className={`flex items-center mb-8 mt-2 ${isCollapsed ? 'justify-center w-full' : 'gap-3 px-2'}`}>
        {isCollapsed ? (
          <div className="font-serif font-bold text-xl text-white flex items-center justify-center bg-black rounded-lg w-10 h-10 shrink-0 select-none">
             T
          </div>
        ) : (
          <h1 className="font-serif font-bold text-2xl tracking-tight text-gray-900 truncate select-none">
            TechPack<span className="text-gray-400 font-sans text-xs ml-1.5 tracking-normal uppercase font-semibold">Gen</span>
          </h1>
        )}
      </div>

      <nav className={`flex-1 space-y-2 mt-4 w-full`}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            title={isCollapsed ? link.label : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-lg transition-all duration-200 border ${
                isActive
                  ? 'border-gray-900 text-gray-900 font-medium bg-gray-50/50'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              } ${isCollapsed ? 'justify-center p-3 w-12 mx-auto' : 'justify-start px-4 py-3'}`
            }
          >
            {({ isActive }) => (
              <div className={`flex items-center text-sm ${isCollapsed ? 'justify-center gap-0' : 'gap-3'}`}>
                <link.icon size={18} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                {!isCollapsed && <span className="truncate">{link.label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2 w-full flex flex-col items-center">
        <button onClick={() => setIsSettingsOpen(true)} title={isCollapsed ? "Settings" : undefined} className={`flex items-center rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all border border-transparent text-sm w-full ${isCollapsed ? 'justify-center p-3 w-12' : 'gap-3 px-4 py-3 justify-start'}`}>
          <Settings size={18} className="shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </button>
        <button onClick={logout} title={isCollapsed ? "Log Out" : undefined} className={`flex items-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all border border-transparent text-sm w-full ${isCollapsed ? 'justify-center p-3 w-12' : 'gap-3 px-4 py-3 justify-start'}`}>
          <LogOut size={18} className="shrink-0" />
          {!isCollapsed && <span>Log Out</span>}
        </button>

        <div className="w-full pt-4 border-t border-gray-100 flex justify-center">
           <button onClick={() => setIsCollapsed(!isCollapsed)} className={`flex items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all text-sm ${isCollapsed ? 'justify-center p-3 w-12' : 'gap-3 px-4 py-2 w-full justify-start'}`}>
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              {!isCollapsed && <span>Collapse</span>}
           </button>
        </div>
      </div>

      {isSettingsOpen && (
        <CompanySettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}
    </aside>
  );
}
