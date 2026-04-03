import React, { useState, useRef } from 'react';
import { Target, X, Plus } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

export interface DetailItem {
  id: string; // e.g., "1", "2"
  description: string;
  position: Point | null; // null if not placed yet
  imageIndex?: number;
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!activeId || !containerRef.current) return;
    
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
    onUpdateDetail(index, { ...details[index], position: null, imageIndex: undefined });
  };

  const activeImageUrl = images[activeImageIndex];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-wrap items-center gap-2 mb-1 print:hidden" style={{ minHeight: '32px' }}>
        {details.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveId(activeId === d.id ? null : d.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeId === d.id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Target size={14} />
            Place #{d.id}
          </button>
        ))}
      </div>

      <div 
        className={`bg-white rounded-2xl border relative overflow-hidden flex-1 ${
          activeId ? 'border-blue-500 ring-4 ring-blue-500/20 cursor-crosshair' : 'border-gray-200'
        } aspect-[4/3] relative group/main`}
      >
        {activeImageUrl ? (
          <div className="absolute inset-0 flex items-center justify-center p-2 md:p-4 h-full pointer-events-none">
            <div 
              ref={containerRef}
              onPointerDown={handlePointerDown}
              style={{ touchAction: 'none' }}
              className={`relative flex max-w-full max-h-full h-full pointer-events-auto ${activeId ? 'cursor-crosshair' : ''}`}
            >
              <img 
                src={activeImageUrl} 
                alt="Detail Closeup" 
                draggable={false}
                className="max-w-full max-h-full object-contain pointer-events-none w-full grow"
              />
          
              {/* Stickers Layer */}
              {details.map((d, index) => {
                const targetIdx = d.imageIndex ?? 0;
                if (!d.position || targetIdx !== activeImageIndex) return null;
                return (
                  <div 
                    key={d.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 bg-red-500 border-2 border-white text-white rounded-full text-xs font-bold shadow-md cursor-pointer group pointer-events-auto z-10"
                    style={{ left: `${d.position.x}%`, top: `${d.position.y}%` }}
                  >
                    <span className="group-hover:hidden">{d.id}</span>
                    <button 
                      onClick={(e) => removeSticker(e, index)} 
                      className="hidden group-hover:flex items-center justify-center w-full h-full bg-black/90 rounded-full"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
            {onRemoveImage && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRemoveImage(activeImageIndex); if (activeImageIndex > 0) setActiveImageIndex(prev => prev - 1); }} 
                className="absolute top-3 right-3 p-1.5 bg-white rounded-full shadow-lg text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover/main:opacity-100 transition-opacity print:hidden pointer-events-auto border border-gray-100"
                title="Remove image"
              >
                <X size={16} />
              </button>
            )}
          </div>
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
