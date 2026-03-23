import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Settings, Layers, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Sidebar() {
  const { logout } = useAuth();
  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/create', icon: PlusCircle, label: 'Create Tech Pack' },
  ];

  return (
    <aside className="w-64 h-screen shrink-0 border-r border-white/5 bg-black/20 backdrop-blur-xl flex flex-col p-4 fixed left-0 top-0 z-30">
      <div className="flex items-center gap-3 px-2 mb-8 mt-2">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
          <Layers className="text-white w-4 h-4" />
        </div>
        <h1 className="font-bold text-lg tracking-tight">TechPack OS</h1>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600/10 text-blue-400 font-medium'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <link.icon size={20} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-1">
        <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all">
          <Settings size={20} />
          Settings
        </button>
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all">
          <LogOut size={20} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
