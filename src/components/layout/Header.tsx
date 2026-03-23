import React from 'react';
import { Bell } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <h2 className="text-gray-300 font-medium">Workspace</h2>
      </div>
      
      <div className="flex items-center gap-5">
        <button className="text-gray-400 hover:text-white transition-colors">
          <Bell size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 opacity-80 border border-white/20" />
      </div>
    </header>
  );
}
