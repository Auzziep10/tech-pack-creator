import React, { useState, useRef } from 'react';
import { Target, X } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

export interface DetailItem {
  id: string; // e.g., "1", "2"
  description: string;
  position: Point | null; // null if not placed yet
}

interface DetailAnnotatorProps {
  imageUrl: string;
  details: DetailItem[];
  onUpdateDetail: (index: number, detail: DetailItem) => void;
}

export function DetailAnnotator({ imageUrl, details, onUpdateDetail }: DetailAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!activeId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const index = details.findIndex(d => d.id === activeId);
    if (index !== -1) {
      onUpdateDetail(index, { ...details[index], position: { x, y } });
    }
    setActiveId(null);
  };

  const removeSticker = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    onUpdateDetail(index, { ...details[index], position: null });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2 mb-2 print:hidden overflow-x-auto pb-1">
        {details.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveId(activeId === d.id ? null : d.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
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
        } aspect-[4/3]`}
      >
        <div className="absolute inset-0 flex items-center justify-center p-4 h-full pointer-events-none">
          <div 
            ref={containerRef}
            onPointerDown={handlePointerDown}
            style={{ touchAction: 'none' }}
            className={`relative flex max-w-full max-h-full h-full pointer-events-auto ${activeId ? 'cursor-crosshair' : ''}`}
          >
            <img 
              src={imageUrl} 
              alt="Detail Closeup" 
              draggable={false}
              className="max-w-full max-h-full object-contain pointer-events-none w-full grow"
            />
        
            {/* Stickers Layer */}
            {details.map((d, index) => {
              if (!d.position) return null;
              return (
                <div 
                  key={d.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 bg-red-500 border-2 border-white text-white rounded-full text-xs font-bold shadow-md cursor-pointer group pointer-events-auto"
                  style={{ left: `${d.position.x}%`, top: `${d.position.y}%` }}
                >
                  <span className="group-hover:hidden">{d.id}</span>
                  <button 
                    onClick={(e) => removeSticker(e, index)} 
                    className="hidden group-hover:flex items-center justify-center w-full h-full bg-black/80 rounded-full"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
