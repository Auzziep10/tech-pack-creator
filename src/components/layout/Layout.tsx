import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#fafafa] text-gray-900">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
