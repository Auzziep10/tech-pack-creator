import React, { useState, useRef } from 'react';
import { Pencil, Trash2, MousePointer2, CheckCircle2 } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Annotation {
  id: string;
  start: Point;
  end: Point;
  label: string;
}

interface GarmentAnnotatorProps {
  imageUrl: string;
  measurements: any[];
}

export function GarmentAnnotator({ imageUrl, measurements }: GarmentAnnotatorProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState('');
  
  const [currentStart, setCurrentStart] = useState<Point | null>(null);
  const [currentMouse, setCurrentMouse] = useState<Point | null>(null);
  const [isBlueprintMode, setIsBlueprintMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawingMode || !selectedMeasurement || !containerRef.current) return;
    
    // Fix issue where clicking outside the image breaks boundary coords
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentStart({ x, y });
    setCurrentMouse({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!currentStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentMouse({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (currentStart && currentMouse) {
      setAnnotations(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          start: currentStart,
          end: currentMouse,
          label: selectedMeasurement
        }
      ]);
    }
    setCurrentStart(null);
    setCurrentMouse(null);
    setIsDrawingMode(false); // turn off drawing mode after 1 line
    setSelectedMeasurement('');
  };

  const removeAnnotation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Artboard Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 p-3 rounded-xl shadow-sm">
         <button 
           onClick={() => setIsBlueprintMode(!isBlueprintMode)}
           className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${isBlueprintMode ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
         >
           Blueprint Filter
         </button>
         
         <div className="w-px h-6 bg-gray-200 mx-1" />
         
         <select
           value={selectedMeasurement}
           onChange={(e) => setSelectedMeasurement(e.target.value)}
           className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none w-48 font-medium"
         >
           <option value="">Select Measurement...</option>
           {measurements.map((m: any, i: number) => (
             <option key={i} value={m.point}>{m.point}</option>
           ))}
         </select>
         
         <button 
           onClick={() => setIsDrawingMode(!isDrawingMode)}
           disabled={!selectedMeasurement}
           className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
             !selectedMeasurement ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400' :
             isDrawingMode ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-gray-900 text-white hover:bg-black'
           }`}
         >
           <Pencil size={14} />
           {isDrawingMode ? 'Draw Now...' : 'Add Callout Line'}
         </button>
      </div>

      {/* Interactive Main Canvas */}
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: 'none' }}
        className={`bg-gray-50 rounded-2xl border aspect-[4/5] flex items-center justify-center p-6 relative overflow-hidden group ${
          isDrawingMode ? 'border-blue-500 ring-4 ring-blue-500/20 cursor-crosshair' : 'border-gray-200'
        }`}
      >
        <img 
          src={imageUrl} 
          alt="Garment Artboard" 
          draggable={false}
          className={`w-full h-full object-contain pointer-events-none transition-all duration-700 ${
            isBlueprintMode ? 'grayscale contrast-125 brightness-110 sepia-[.1] hue-rotate-180 drop-shadow-[0_0_15px_rgba(0,100,255,0.1)]' : 'mix-blend-multiply'
          }`}
        />
        
        {/* SVG Drawing Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={isBlueprintMode ? "#3b82f6" : "#ef4444"} />
            </marker>
          </defs>

          {annotations.map((ann, i) => (
            <g key={ann.id}>
              <line 
                x1={`${ann.start.x}%`} 
                y1={`${ann.start.y}%`} 
                x2={`${ann.end.x}%`} 
                y2={`${ann.end.y}%`} 
                stroke={isBlueprintMode ? "#3b82f6" : "#ef4444"} 
                strokeWidth="2.5" 
                markerStart="url(#arrow)"
                markerEnd="url(#arrow)"
                strokeDasharray="4 4"
              />
              <foreignObject x={`${(ann.start.x + ann.end.x)/2}%`} y={`${(ann.start.y + ann.end.y)/2}%`} width="1" height="1" className="overflow-visible pointer-events-auto">
                <div className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 group/badge cursor-pointer">
                  <div className={`px-2 py-0.5 rounded shadow-sm text-[10px] font-bold tracking-wider whitespace-nowrap ${
                    isBlueprintMode ? 'bg-blue-600 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {ann.label}
                  </div>
                  <button onClick={(e) => removeAnnotation(ann.id, e)} className="opacity-0 group-hover/badge:opacity-100 bg-black/80 text-white p-1 rounded-full transition-opacity hover:bg-black">
                    <Trash2 size={10} />
                  </button>
                </div>
              </foreignObject>
            </g>
          ))}

          {currentStart && currentMouse && (
            <line 
              x1={`${currentStart.x}%`} 
              y1={`${currentStart.y}%`} 
              x2={`${currentMouse.x}%`} 
              y2={`${currentMouse.y}%`} 
              stroke="#3b82f6" 
              strokeWidth="2" 
              strokeDasharray="4 4"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
