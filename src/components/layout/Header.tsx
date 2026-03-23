import React from 'react';
import { Bell, Search } from 'lucide-react';

export function Header() {
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
      
      <div className="flex items-center gap-5">
        <button className="text-gray-400 hover:text-gray-900 transition-colors">
          <Bell size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
          AU
        </div>
      </div>
    </header>
  );
}
