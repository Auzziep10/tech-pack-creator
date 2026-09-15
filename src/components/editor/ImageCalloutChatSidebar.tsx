import React, { useState, useRef, useEffect } from 'react';
import { 
  MapPin, 
  Send, 
  CheckCircle2, 
  Trash2, 
  X, 
  MessageSquare, 
  Check, 
  RotateCcw
} from 'lucide-react';
import { ImageCalloutComment } from '../../services/dbService';

interface ImageCalloutChatSidebarProps {
  comments: ImageCalloutComment[];
  activeCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  isDroppingPin: boolean;
  onToggleDropPin: (dropping: boolean) => void;
  nextPinNumber: number;
  pendingPin: { x: number; y: number } | null;
  onCancelPendingPin: () => void;
  onAddComment: (text: string, pinCoord?: { x: number; y: number }) => Promise<void>;
  onToggleResolveComment: (id: string, currentResolved: boolean) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  currentUserName: string;
  currentUserUid: string;
  onClose: () => void;
}

export function ImageCalloutChatSidebar({
  comments,
  activeCommentId,
  onSelectComment,
  isDroppingPin,
  onToggleDropPin,
  nextPinNumber,
  pendingPin,
  onCancelPendingPin,
  onAddComment,
  onToggleResolveComment,
  onDeleteComment,
  currentUserName,
  currentUserUid,
  onClose
}: ImageCalloutChatSidebarProps) {
  const [filterTab, setFilterTab] = useState<'open' | 'resolved' | 'all'>('open');
  const [inputText, setInputText] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const listEndRef = useRef<HTMLDivElement>(null);
  const pendingInputRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Focus pending input when a pin is dropped on the canvas
  useEffect(() => {
    if (pendingPin && pendingInputRef.current) {
      pendingInputRef.current.focus();
    }
  }, [pendingPin]);

  const openCount = comments.filter(c => !c.resolved).length;
  const resolvedCount = comments.filter(c => c.resolved).length;

  const filteredComments = comments.filter(c => {
    if (filterTab === 'open') return !c.resolved;
    if (filterTab === 'resolved') return c.resolved;
    return true;
  });

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddComment(inputText.trim());
      setInputText('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendPendingPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingPin || !pendingText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddComment(pendingText.trim(), pendingPin);
      setPendingText('');
      onCancelPendingPin();
    } catch (err) {
      console.error('Failed to post pinned callout:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Just now';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  };

  return (
    <aside className="w-80 md:w-96 h-full flex flex-col bg-white border-l border-gray-200 shadow-xl select-none z-30 shrink-0">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <MessageSquare size={15} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 leading-none">Callouts & Chat</h4>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {openCount} active callout{openCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition cursor-pointer"
          title="Close Sidebar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Action Bar: Drop Pin Mode Trigger */}
      <div className="p-2.5 border-b border-gray-100 bg-white space-y-2">
        <button
          type="button"
          onClick={() => onToggleDropPin(!isDroppingPin)}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
            isDroppingPin
              ? 'bg-blue-600 text-white shadow-blue-500/25 ring-2 ring-blue-500/30 animate-pulse'
              : 'bg-gray-900 text-white hover:bg-black hover:shadow-sm'
          }`}
        >
          <MapPin size={15} className={isDroppingPin ? 'animate-bounce' : ''} />
          <span>
            {isDroppingPin ? `Click image to drop Pin #${nextPinNumber}` : `+ Drop Pin on Image (#${nextPinNumber})`}
          </span>
        </button>

        {isDroppingPin && (
          <div className="text-[11px] text-center text-blue-600 bg-blue-50 py-1.5 px-2 rounded-lg font-medium border border-blue-100 flex items-center justify-between">
            <span>Click anywhere on the garment to place pin #{nextPinNumber}</span>
            <button 
              type="button" 
              onClick={() => onToggleDropPin(false)} 
              className="text-[10px] text-gray-500 hover:text-black underline font-bold ml-1"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-[11px] font-semibold text-gray-600">
          <button
            type="button"
            onClick={() => setFilterTab('open')}
            className={`flex-1 py-1 rounded-md transition-all text-center ${
              filterTab === 'open' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'hover:text-gray-900'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('resolved')}
            className={`flex-1 py-1 rounded-md transition-all text-center ${
              filterTab === 'resolved' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'hover:text-gray-900'
            }`}
          >
            Resolved ({resolvedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`flex-1 py-1 rounded-md transition-all text-center ${
              filterTab === 'all' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'hover:text-gray-900'
            }`}
          >
            All ({comments.length})
          </button>
        </div>
      </div>

      {/* Comment List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/40">
        {/* Pending Pin Draft Composer */}
        {pendingPin && (
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 shadow-xs space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
                  {nextPinNumber}
                </span>
                <span className="text-xs font-bold text-blue-900">Pin placed at {Math.round(pendingPin.x)}%, {Math.round(pendingPin.y)}%</span>
              </div>
              <button
                type="button"
                onClick={onCancelPendingPin}
                className="text-gray-400 hover:text-gray-600 p-0.5"
                title="Cancel pin"
              >
                <X size={14} />
              </button>
            </div>

            <textarea
              ref={pendingInputRef}
              value={pendingText}
              onChange={(e) => setPendingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendPendingPin();
                }
              }}
              placeholder={`Describe callout #${nextPinNumber} (e.g. Check seam allowance here)...`}
              rows={2}
              className="w-full text-xs p-2 rounded-lg bg-white border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
            />

            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={onCancelPendingPin}
                className="px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-white rounded-md transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pendingText.trim() || isSubmitting}
                onClick={() => handleSendPendingPin()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-md shadow-xs transition flex items-center gap-1 cursor-pointer"
              >
                <Send size={11} />
                <span>Post Pin</span>
              </button>
            </div>
          </div>
        )}

        {filteredComments.map((c) => {
          const isActive = activeCommentId === c.id;
          const isCreator = c.authorUid === currentUserUid;

          return (
            <div
              key={c.id}
              onClick={() => onSelectComment(isActive ? null : c.id)}
              className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-400/20 shadow-sm'
                  : c.resolved
                    ? 'bg-white/80 border-gray-100 opacity-75 hover:opacity-100'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs'
              }`}
            >
              {/* Top Row: Pin Badge, Author Info, Time */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs ${
                      c.resolved
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {c.pinNumber}
                  </div>
                  <span className="text-xs font-bold text-gray-900 truncate">
                    {c.authorName || 'Teammate'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {formatTime(c.createdAt)}
                </span>
              </div>

              {/* Comment Content */}
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed break-words pl-7">
                {c.text}
              </p>

              {/* Footer Actions: Resolve & Delete */}
              <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between pl-7">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleResolveComment(c.id, Boolean(c.resolved));
                  }}
                  className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded transition cursor-pointer ${
                    c.resolved
                      ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'text-gray-500 hover:text-emerald-600 hover:bg-gray-100'
                  }`}
                  title={c.resolved ? 'Reopen callout' : 'Mark as resolved'}
                >
                  {c.resolved ? (
                    <>
                      <RotateCcw size={11} />
                      <span>Resolved</span>
                    </>
                  ) : (
                    <>
                      <Check size={11} />
                      <span>Resolve</span>
                    </>
                  )}
                </button>

                {(isCreator || true) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this callout pin and comment?')) {
                        onDeleteComment(c.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition"
                    title="Delete callout"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredComments.length === 0 && !pendingPin && (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
              <MapPin size={20} />
            </div>
            <p className="text-xs font-semibold text-gray-700">No callouts yet</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[200px] mx-auto">
              Click &quot;+ Drop Pin on Image&quot; above to point out details or leave feedback.
            </p>
          </div>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Chat Channel Message Input */}
      <form onSubmit={handleSendChat} className="p-2.5 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <button
            type="button"
            onClick={() => onToggleDropPin(true)}
            className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
            title={`Drop Pin #${nextPinNumber} on Image`}
          >
            <MapPin size={16} />
          </button>

          <input
            ref={chatInputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type comment or click pin..."
            className="flex-1 bg-transparent text-xs outline-none text-gray-800 placeholder:text-gray-400"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSubmitting}
            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white transition cursor-pointer shadow-2xs"
            title="Send comment"
          >
            <Send size={13} />
          </button>
        </div>
      </form>
    </aside>
  );
}
