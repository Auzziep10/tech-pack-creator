import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, Database, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function DiagnosticBanner() {
  const { isCoreAdmin, inspectedCompany, exitInspection } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isCoreAdmin || !inspectedCompany) {
    return null;
  }

  const handleExit = () => {
    exitInspection();
    if (location.pathname !== '/admin/inspector') {
      navigate('/admin/inspector');
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-md sticky top-0 z-40 px-4 py-2 text-xs sm:text-sm font-medium">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-200 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <div className="flex items-center gap-1.5 font-bold tracking-wide">
            <ShieldAlert size={16} className="text-yellow-200 shrink-0" />
            <span>DIAGNOSTICS MODE:</span>
          </div>
          <span className="text-white/90">
            Viewing workspace <strong className="text-white underline underline-offset-2">{inspectedCompany.name}</strong>
          </span>
          <span className="hidden md:inline-block bg-black/25 px-2 py-0.5 rounded font-mono text-[11px] text-white/80">
            ID: {inspectedCompany.id}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {location.pathname !== '/' && (
            <button
              onClick={() => navigate('/')}
              className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Go to inspected team's Dashboard"
            >
              <LayoutDashboard size={13} />
              <span>Team Dashboard</span>
            </button>
          )}

          {location.pathname !== '/admin/inspector' && (
            <button
              onClick={() => navigate('/admin/inspector')}
              className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Return to Team Inspector Hub"
            >
              <Database size={13} />
              <span>Inspector Hub</span>
            </button>
          )}

          <button
            onClick={handleExit}
            className="bg-black/40 hover:bg-black/60 text-white border border-white/20 px-3 py-1 rounded-md transition-all flex items-center gap-1.5 text-xs font-bold shadow-xs hover:border-white/40 cursor-pointer"
            title="Exit inspection and return to your own workspace"
          >
            <X size={14} />
            <span>Exit Diagnostics</span>
          </button>
        </div>
      </div>
    </div>
  );
}
