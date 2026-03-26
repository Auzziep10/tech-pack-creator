import React, { useState } from 'react';
import { Bell, Search, LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const getInitials = () => {
    if (user?.displayName) return user.displayName.substring(0, 2).toUpperCase();
    if (user?.email) return user.email.substring(0, 2).toUpperCase();
    return 'AU';
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-gray-200 bg-white sticky top-0 z-20 flex items-center justify-between px-8">
      <div className="flex items-center gap-4 w-96">
        <div className="relative w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
           <input 
              placeholder="Search active orders..." 
              className="w-full bg-gray-50 border border-gray-200 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 transition-all" 
           />
        </div>
      </div>
      
      <div className="flex items-center gap-5 relative">
        <button 
           onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}
           className="text-gray-400 hover:text-gray-900 transition-colors relative outline-none"
        >
          <Bell size={20} />
        </button>

        {showNotifs && (
           <div className="absolute top-10 right-10 w-72 bg-white border border-gray-100 rounded-xl shadow-lg p-4 z-50 animate-in slide-in-from-top-2 fade-in">
             <h3 className="font-bold text-gray-900 mb-2 border-b border-gray-50 pb-2">Notifications</h3>
             <div className="py-6 text-center text-sm text-gray-500 font-medium">You're all caught up!</div>
           </div>
        )}

        <button 
           onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
           className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold ring-2 ring-transparent hover:ring-gray-200 transition-all outline-none"
        >
          {getInitials()}
        </button>

        {showProfile && (
           <div className="absolute top-12 right-0 w-64 bg-white border border-gray-100 rounded-xl shadow-lg p-2 z-50 animate-in slide-in-from-top-2 fade-in">
             <div className="px-3 py-2 border-b border-gray-50 mb-1">
               <p className="font-bold text-gray-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{user?.displayName || 'Designer'}</p>
               <p className="text-gray-500 text-xs truncate">{user?.email}</p>
             </div>
             <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left" onClick={() => setShowProfile(false)}>
               <User size={16} className="text-gray-400" /> View Profile
             </button>
             <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left font-medium mt-1">
               <LogOut size={16} /> Sign Out
             </button>
           </div>
        )}
      </div>
    </header>
  );
}
