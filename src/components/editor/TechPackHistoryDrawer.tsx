import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, 
  X, 
  Search, 
  Ruler, 
  Layers, 
  Tag, 
  Image as ImageIcon, 
  MessageSquare, 
  Shield, 
  FileDown, 
  Sparkles,
  Calendar,
  Clock
} from 'lucide-react';
import { ActivityLogEntry } from '../../services/dbService';

interface TechPackHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activityLog?: ActivityLogEntry[];
}

type CategoryType = 'all' | 'measurement' | 'bom' | 'property' | 'image' | 'comment' | 'security' | 'export';

const getCategoryDetails = (log: ActivityLogEntry): { label: string; icon: React.ReactNode; color: string; bg: string; border: string } => {
  const msg = (log.message || '').toLowerCase();
  const explicit = log.category;

  if (explicit === 'measurement' || msg.includes('measurement') || msg.includes('computed size') || msg.includes('grade')) {
    return {
      label: 'Measurement',
      icon: <Ruler size={12} />,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200'
    };
  }

  if (explicit === 'bom' || msg.includes('bom') || msg.includes('fabric') || msg.includes('trim')) {
    return {
      label: 'BOM',
      icon: <Layers size={12} />,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200'
    };
  }

  if (explicit === 'property' || msg.includes('style') || msg.includes('season') || msg.includes('category') || msg.includes('designer') || msg.includes('color') || msg.includes('rename') || msg.includes('unit')) {
    return {
      label: 'Garment Spec',
      icon: <Tag size={12} />,
      color: 'text-purple-700',
      bg: 'bg-purple-50',
      border: 'border-purple-200'
    };
  }

  if (explicit === 'image' || msg.includes('image') || msg.includes('mannequin') || msg.includes('vector') || msg.includes('recolor') || msg.includes('studio') || msg.includes('scan') || msg.includes('detail module')) {
    return {
      label: 'Visual Asset',
      icon: <ImageIcon size={12} />,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200'
    };
  }

  if (explicit === 'comment' || msg.includes('callout pin') || msg.includes('comment')) {
    return {
      label: 'Callout Chat',
      icon: <MessageSquare size={12} />,
      color: 'text-indigo-700',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200'
    };
  }

  if (explicit === 'security' || msg.includes('lock') || msg.includes('permission')) {
    return {
      label: 'Security & Lock',
      icon: <Shield size={12} />,
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200'
    };
  }

  if (explicit === 'export' || msg.includes('export') || msg.includes('pdf') || msg.includes('wovn') || msg.includes('sync')) {
    return {
      label: 'Export & Sync',
      icon: <FileDown size={12} />,
      color: 'text-sky-700',
      bg: 'bg-sky-50',
      border: 'border-sky-200'
    };
  }

  return {
    label: 'General',
    icon: <Sparkles size={12} />,
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    border: 'border-gray-200'
  };
};

const formatRelativeTime = (isoString?: string): string => {
  if (!isoString) return 'Just now';
  const time = new Date(isoString).getTime();
  if (isNaN(time)) return 'Just now';

  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 90) return '1m ago';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    const isToday = new Date().toDateString() === new Date(time).toDateString();
    if (isToday) {
      return `Today at ${new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `${diffHr}h ago`;
  }

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) {
    return `Yesterday at ${new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Date(time).toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric',
    year: new Date(time).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
};

const formatUserName = (userStr?: string): string => {
  if (!userStr || userStr === 'Unknown') return 'Collaborator';
  if (userStr.includes('@')) {
    const namePart = userStr.split('@')[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }
  return userStr;
};

const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-600 text-white',
    'bg-purple-600 text-white',
    'bg-emerald-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white',
    'bg-indigo-600 text-white',
    'bg-teal-600 text-white'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const TechPackHistoryDrawer: React.FC<TechPackHistoryDrawerProps> = ({
  isOpen,
  onClose,
  activityLog = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('all');

  const filteredLogs = useMemo(() => {
    let list = [...activityLog].reverse();

    if (activeCategory !== 'all') {
      list = list.filter(item => {
        const cat = getCategoryDetails(item).label.toLowerCase();
        if (activeCategory === 'measurement') return cat.includes('measurement');
        if (activeCategory === 'bom') return cat.includes('bom');
        if (activeCategory === 'property') return cat.includes('garment') || cat.includes('spec');
        if (activeCategory === 'image') return cat.includes('visual') || cat.includes('asset');
        if (activeCategory === 'comment') return cat.includes('callout') || cat.includes('chat');
        if (activeCategory === 'security') return cat.includes('security') || cat.includes('lock');
        if (activeCategory === 'export') return cat.includes('export') || cat.includes('sync');
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => 
        (item.message && item.message.toLowerCase().includes(q)) ||
        (item.user && item.user.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activityLog, activeCategory, searchQuery]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end print:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Container */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative w-full max-w-md bg-white h-full shadow-2xl z-50 flex flex-col border-l border-gray-200"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow-xs">
                  <History size={17} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-base">Tech Pack History</h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-200/80 text-gray-700">
                      {activityLog.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Real-time audit log of changes</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search & Filters */}
            <div className="p-3 sm:px-4 border-b border-gray-100 bg-white space-y-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter activity by keyword or user..."
                  className="w-full pl-8.5 pr-8 py-1.5 bg-gray-50 hover:bg-gray-100/80 focus:bg-white text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'measurement', label: 'Measurements' },
                  { id: 'bom', label: 'BOM' },
                  { id: 'property', label: 'Specs' },
                  { id: 'image', label: 'Assets' },
                  { id: 'comment', label: 'Callouts' },
                  { id: 'security', label: 'Locks' },
                  { id: 'export', label: 'Export' }
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setActiveCategory(chip.id as CategoryType)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg shrink-0 transition-colors ${
                      activeCategory === chip.id
                        ? 'bg-gray-900 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => {
                  const cat = getCategoryDetails(log);
                  const userName = formatUserName(log.user);
                  const initial = userName.charAt(0).toUpperCase();
                  const avatarBg = getAvatarColor(userName);
                  const relTime = formatRelativeTime(log.timestamp);
                  const fullDate = log.timestamp 
                    ? new Date(log.timestamp).toLocaleString(undefined, { 
                        dateStyle: 'medium', 
                        timeStyle: 'medium' 
                      })
                    : '';

                  return (
                    <motion.div
                      key={`${log.timestamp}-${index}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group p-3 rounded-xl border border-gray-200/70 bg-white hover:border-gray-300 hover:shadow-xs transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${avatarBg}`}>
                            {initial}
                          </div>
                          <div className="font-semibold text-xs text-gray-900 truncate">
                            {userName}
                          </div>
                        </div>

                        {/* Category Chip */}
                        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${cat.bg} ${cat.color} ${cat.border}`}>
                          {cat.icon}
                          <span>{cat.label}</span>
                        </div>
                      </div>

                      {/* Log Message */}
                      <p className="text-xs text-gray-800 font-normal leading-relaxed pl-8">
                        {log.message}
                      </p>

                      {/* Timestamp Footnote */}
                      <div className="flex items-center gap-1 mt-2 pl-8 text-[10px] text-gray-400 group-hover:text-gray-500 transition-colors" title={fullDate}>
                        <Clock size={11} className="shrink-0" />
                        <span>{relTime}</span>
                        <span className="text-gray-300">•</span>
                        <span className="truncate">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3 text-gray-400">
                    <History size={22} />
                  </div>
                  <p className="text-xs font-semibold text-gray-700">No activity recorded</p>
                  <p className="text-[11px] text-gray-400 mt-1 max-w-[200px]">
                    {searchQuery ? 'No log entries match your filter.' : 'Changes made to this tech pack will appear here.'}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/80 text-[11px] text-gray-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Calendar size={12} /> Real-time Firestore sync
              </span>
              <span>Showing {filteredLogs.length} of {activityLog.length}</span>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
