import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Settings, Layers, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Sidebar() {
  const { logout, profile } = useAuth();
  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/create', icon: PlusCircle, label: 'Create Tech Pack' },
  ];

  const handleSettings = async () => {
    if (!profile) return;
    const newCompanyId = window.prompt(
      "Your current Company ID is below. Share this exact ID with team members so you can collaborate on the same Tech Packs. To join another company, paste their ID here:",
      profile.companyId
    );
    if (newCompanyId && newCompanyId.trim() !== profile.companyId) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../../services/firebase');
        await updateDoc(doc(db, 'users', profile.uid), { companyId: newCompanyId.trim() });
        alert("Company ID updated successfully!");
        window.location.reload();
      } catch (err: any) {
        console.error(err);
        alert("Failed to update company ID");
      }
    }
  };

  return (
    <aside className="w-64 h-screen shrink-0 border-r border-gray-200 bg-white flex flex-col p-4 fixed left-0 top-0 z-30">
      <div className="flex items-center gap-3 px-2 mb-8 mt-2">
        <h1 className="font-serif font-bold text-2xl tracking-tight text-gray-900">
          TechPack<span className="text-gray-400 font-sans text-xs ml-2 tracking-normal uppercase font-semibold">Generator</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-1 mt-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 border ${
                isActive
                  ? 'border-gray-900 text-gray-900 font-medium'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <div className="flex items-center gap-3 text-sm">
                <link.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {link.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-1">
        <button onClick={handleSettings} className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all border border-transparent text-sm">
          <Settings size={18} />
          Settings
        </button>
        <button onClick={logout} className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all border border-transparent text-sm">
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
