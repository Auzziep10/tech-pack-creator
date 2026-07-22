import React, { useState, useRef, useEffect } from 'react';
import { Target, X, Plus, Lock, Unlock } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

export interface DetailItem {
  id: string; // e.g., "1", "2"
  description: string;
  position: Point | null; // null if not placed yet
  lineEndPosition?: Point | null; // end of callout line
  imageIndex?: number;
  iconUrl?: string;
}

interface DetailAnnotatorProps {
  images: string[];
  details: DetailItem[];
  onUpdateDetail: (index: number, detail: DetailItem) => void;
  onRemoveImage?: (index: number) => void;
  onAddImageClick?: () => void;
  qrTriggerNode?: React.ReactNode;
}

export function DetailAnnotator({ images, details, onUpdateDetail, onRemoveImage, onAddImageClick, qrTriggerNode }: DetailAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{ id: string; part: 'badge' | 'lineEnd' } | null>(null);

  // Global pointer listeners for smooth dragging
  useEffect(() => {
    if (!draggedItem) return;

    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      const index = details.findIndex(d => d.id === draggedItem.id);
      if (index !== -1) {
        const updated = { ...details[index] };
        if (draggedItem.part === 'badge') {
          updated.position = { x, y };
        } else {
          updated.lineEndPosition = { x, y };
        }
        onUpdateDetail(index, updated);
      }
    };

    const handleGlobalPointerUp = () => {
      setDraggedItem(null);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [draggedItem, details, onUpdateDetail]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isLocked || !activeId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const index = details.findIndex(d => d.id === activeId);
    if (index !== -1) {
      onUpdateDetail(index, { ...details[index], position: { x, y }, imageIndex: activeImageIndex });
    }
    setActiveId(null);
  };

  const removeSticker = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    onUpdateDetail(index, { ...details[index], position: null, lineEndPosition: null, imageIndex: undefined });
  };

  const handleStartDrag = (e: React.PointerEvent, id: string, part: 'badge' | 'lineEnd') => {
    if (isLocked || (e.target as HTMLElement).closest('button')) {
      return;
    }
    e.stopPropagation();
    setDraggedItem({ id, part });
  };

  const activeImageUrl = images[activeImageIndex];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-wrap items-center gap-2 mb-1 print:hidden" style={{ minHeight: '32px' }}>
        {details.map((d) => (
          <button
            key={d.id}
            onClick={() => !isLocked && setActiveId(activeId === d.id ? null : d.id)}
            disabled={isLocked}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 shrink-0 ${
              isLocked
                ? 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-100'
                : activeId === d.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Target size={14} />
            Place #{d.id}
          </button>
        ))}
        
        {/* Lock / Unlock Toggle Button */}
        <button
          onClick={() => {
            setIsLocked(!isLocked);
            setActiveId(null); // Clear active placement state when locking
          }}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 shrink-0 border ml-auto ${
            isLocked 
              ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' 
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
          title={isLocked ? "Unlock annotations to edit/drag" : "Lock annotations to prevent editing/dragging"}
        >
          {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          {isLocked ? "Locked" : "Lock Layout"}
        </button>
      </div>

      <div 
        className={`bg-gray-50 rounded-2xl border flex-1 print:flex-none print:h-auto print:border-none print:bg-transparent ${
          activeId ? 'border-blue-500 ring-4 ring-blue-500/20 cursor-crosshair' : 'border-gray-200'
        } relative group/main flex flex-col p-2 print:p-0 min-h-[300px] ${images.length > 1 ? 'print:grid print:grid-cols-2 print:gap-2 print:space-y-0 print:items-start' : 'print:space-y-4'}`}
      >
        {images.length > 0 ? (
          images.map((imgUrl, imgIdx) => {
            const isActive = imgIdx === activeImageIndex;
            return (
              <div 
                key={imgIdx}
                className={`${isActive ? 'flex flex-1' : 'hidden print:flex'} relative items-center justify-center print:block print:text-center print:break-inside-avoid print:bg-gray-50 print:border print:border-gray-200 print:rounded-2xl print:p-1.5`}
              >
                <div 
                  ref={isActive ? containerRef : undefined}
                  onPointerDown={isActive ? handlePointerDown : undefined}
                  style={{ touchAction: 'none' }}
                  className={`relative flex print:inline-block print:w-auto print:max-h-[6.5in] ${activeId && isActive ? 'cursor-crosshair' : ''}`}
                >
                  <img 
                    src={imgUrl} 
                    alt={`Detail Closeup ${imgIdx + 1}`} 
                    draggable={false}
                    className={`max-w-full h-auto object-contain pointer-events-none rounded-lg shadow-sm ${images.length > 1 ? 'max-h-[700px] print:max-h-[3.2in]' : 'max-h-[700px] print:max-h-[5in]'}`}
                  />
                  
                  {/* SVG Lines Layer */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    {details.map((d) => {
                      const targetIdx = d.imageIndex ?? 0;
                      if (!d.position || !d.lineEndPosition || targetIdx !== imgIdx) return null;
                      return (
                        <g key={`line-${d.id}`}>
                          {/* White outline for high contrast */}
                          <line 
                            x1={`${d.position.x}%`} 
                            y1={`${d.position.y}%`} 
                            x2={`${d.lineEndPosition.x}%`} 
                            y2={`${d.lineEndPosition.y}%`} 
                            stroke="#ffffff" 
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            strokeDasharray="6 4"
                          />
                          {/* Red main line */}
                          <line 
                            x1={`${d.position.x}%`} 
                            y1={`${d.position.y}%`} 
                            x2={`${d.lineEndPosition.x}%`} 
                            y2={`${d.lineEndPosition.y}%`} 
                            stroke="#ef4444" 
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray="6 4"
                          />
                          {/* Endpoint dot */}
                          <circle 
                            cx={`${d.lineEndPosition.x}%`} 
                            cy={`${d.lineEndPosition.y}%`} 
                            r="4" 
                            fill="#ef4444" 
                            stroke="#ffffff" 
                            strokeWidth="1.5"
                          />
                          {/* Draggable endpoint handle (only screen, hidden in print, only on active image, and only when unlocked) */}
                          {isActive && !isLocked && (
                            <circle 
                              cx={`${d.lineEndPosition.x}%`} 
                              cy={`${d.lineEndPosition.y}%`} 
                              r="12" 
                              fill="transparent" 
                              stroke="#ef4444" 
                              strokeWidth="2"
                              className="cursor-move pointer-events-auto hover:fill-red-500/20 active:fill-red-500/40 transition-colors print:hidden"
                              onPointerDown={(e) => handleStartDrag(e, d.id, 'lineEnd')}
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
              
                  {/* Stickers Layer for this specific image */}
                  {details.map((d, dIdx) => {
                    const targetIdx = d.imageIndex ?? 0;
                    if (!d.position || targetIdx !== imgIdx) return null;
                    return (
                      <div 
                        key={d.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-auto z-20"
                        style={{ left: `${d.position.x}%`, top: `${d.position.y}%` }}
                      >
                        {d.iconUrl && (
                          <div className="absolute top-1/2 -translate-y-1/2 left-full ml-1.5 w-16 h-10 bg-white border border-gray-200 rounded-lg shadow-md flex items-center justify-center p-1 pointer-events-auto transition-all duration-200 hover:scale-[3] hover:-translate-y-1/2 hover:z-50 origin-left group/icon">
                            <img src={d.iconUrl} alt="Seam icon" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div 
                          className={`flex items-center justify-center w-8 h-8 bg-red-500 border-2 border-white text-white rounded-full text-xs font-bold shadow-md select-none transition-transform ${
                            isActive && !isLocked ? 'cursor-move hover:scale-110 active:scale-95' : ''
                          }`}
                          onPointerDown={isActive && !isLocked ? (e) => handleStartDrag(e, d.id, 'badge') : undefined}
                        >
                          <span className="group-hover:hidden">{d.id}</span>
                          {isActive && !isLocked && (
                            <button 
                              onClick={(e) => removeSticker(e, dIdx)} 
                              onPointerDown={(e) => e.stopPropagation()}
                              className="hidden group-hover:flex items-center justify-center w-full h-full bg-black/90 rounded-full cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Remove Image Button (Digital only, active only) */}
                {isActive && onRemoveImage && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemoveImage(imgIdx); if (imgIdx > 0) setActiveImageIndex(prev => prev - 1); }} 
                    className="absolute top-3 right-3 p-1.5 bg-white rounded-full shadow-lg text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover/main:opacity-100 transition-opacity print:hidden pointer-events-auto border border-gray-100"
                    title="Remove image"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No image</div>
        )}
      </div>

      {(images.length > 1 || onAddImageClick) && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 print:hidden min-h-[60px]">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveImageIndex(idx)}
              className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                idx === activeImageIndex ? 'border-black shadow-md scale-105 z-10' : 'border-transparent hover:border-gray-300 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} className="w-full h-full object-cover" />
            </button>
          ))}
          {onAddImageClick && (
            <button
              onClick={onAddImageClick}
              className="w-14 h-14 shrink-0 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-black hover:border-black transition-colors hover:bg-gray-50 flex-col gap-0.5"
            >
              <Plus size={16} />
              <span className="text-[9px] font-bold">ADD</span>
            </button>
          )}
          {qrTriggerNode && (
            <div className="ml-2 flex items-center shrink-0">
              {qrTriggerNode}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
