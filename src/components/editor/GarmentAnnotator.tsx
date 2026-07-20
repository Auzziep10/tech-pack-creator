import React, { useState, useRef } from 'react';
import { Pencil, Trash2, MousePointer2, CheckCircle2, Maximize, Minimize, Wand2, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/Button';

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
  onVectorize?: () => void;
  isVectorizing?: boolean;
  onGenerateMannequin?: (gender: string, garmentType: string, viewPoint: string) => Promise<string>;
  onSaveMannequinImage?: (imgUrl: string) => Promise<void>;
}

export function GarmentAnnotator({ 
  imageUrl, 
  measurements, 
  onVectorize, 
  isVectorizing,
  onGenerateMannequin,
  onSaveMannequinImage
}: GarmentAnnotatorProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState('');
  
  const [currentStart, setCurrentStart] = useState<Point | null>(null);
  const [currentMouse, setCurrentMouse] = useState<Point | null>(null);
  const [isBlueprintMode, setIsBlueprintMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showMannequinModal, setShowMannequinModal] = useState(false);
  const [mannequinGender, setMannequinGender] = useState('Unisex');
  const [mannequinGarmentType, setMannequinGarmentType] = useState('Hoodie');
  const [mannequinViewPoint, setMannequinViewPoint] = useState('Front View');
  const [isGeneratingMannequin, setIsGeneratingMannequin] = useState(false);
  const [isSavingMannequin, setIsSavingMannequin] = useState(false);
  const [mannequinResultImage, setMannequinResultImage] = useState<string | null>(null);
  const [mannequinError, setMannequinError] = useState('');

  const handleGenerateMannequin = async () => {
    if (!onGenerateMannequin) return;
    setIsGeneratingMannequin(true);
    setMannequinError('');
    try {
      const generated = await onGenerateMannequin(mannequinGender, mannequinGarmentType, mannequinViewPoint);
      if (generated) {
        setMannequinResultImage(generated);
      }
    } catch (err: any) {
      console.error(err);
      setMannequinError(err.message || 'Failed to generate floating garment. Please try again.');
    } finally {
      setIsGeneratingMannequin(false);
    }
  };

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
      setIsDrawingMode(false); // turn off drawing mode after 1 line
      setSelectedMeasurement('');
    }
    setCurrentStart(null);
    setCurrentMouse(null);
  };

  const removeAnnotation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className={
      isFullscreen 
        ? "fixed inset-0 z-50 bg-gray-900/20 flex flex-col p-4 md:p-8 gap-4 md:gap-6 backdrop-blur-sm animate-in fade-in"
        : "flex flex-col gap-4 flex-1 min-h-0 w-full"
    }>
      {/* Artboard Toolbar */}
      {isFullscreen && (
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 p-3 rounded-xl shadow-sm shrink-0 mx-auto w-full max-w-5xl">
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
           {measurements.map((m: any, i: number) => {
             const label = m.id || (i + 1).toString();
             return (
               <option key={i} value={label}>{label} - {m.point}</option>
             );
           })}
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
         
         <div className="flex-1" />

          {onVectorize && (
            <div className="relative flex items-center">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onVectorize} 
                isLoading={isVectorizing}
                className="gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 shadow-sm mx-2 transition-all"
              >
                <Wand2 size={14} />
                Generate Vector Blueprint
              </Button>
              {isVectorizing && (
                <div className="absolute top-full mt-2 lg:mt-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-purple-100 text-purple-800 text-[11px] lg:text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg border border-purple-200 animate-pulse z-50 pointer-events-none">
                  Feel free to do other things while this loads
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-100 border-l border-t border-purple-200 rotate-45"></div>
                </div>
              )}
            </div>
          )}

          {onGenerateMannequin && (
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowMannequinModal(true)} 
              className="gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm mx-2 transition-all"
            >
              <Sparkles size={14} />
              Invisible Mannequin
            </Button>
          )}
         
         <button 
           onClick={() => setIsFullscreen(false)}
           className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors ml-auto"
           title="Exit Fullscreen"
         >
           <Minimize size={20} />
         </button>
      </div>
      )}

      {/* Interactive Main Canvas */}
      <div 
        className={`select-none bg-white rounded-2xl border relative overflow-hidden group ${
          isDrawingMode ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-gray-200'
        } ${
          isFullscreen ? 'flex-1 min-h-0 mx-auto w-full max-w-5xl shadow-2xl' : 'aspect-[4/5] print:aspect-auto print:flex-1 print:min-h-0 print:w-full'
        }`}
      >
        <div className="absolute inset-6 flex items-center justify-center pointer-events-none">
          <div 
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ touchAction: 'none' }}
            className={`relative flex max-w-full max-h-full pointer-events-auto ${isDrawingMode ? 'cursor-crosshair' : ''}`}
          >
            <img 
              src={imageUrl} 
              alt="Garment Artboard" 
              draggable={false}
              className={`max-w-full max-h-full object-contain pointer-events-none transition-all duration-700 ${
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

      {!isFullscreen && (
          <div 
            className="absolute inset-0 z-20 hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 cursor-pointer" 
            onClick={() => setIsFullscreen(true)}
          >
             <Button variant="secondary" onClick={() => setIsFullscreen(true)} className="shadow-xl gap-2 pointer-events-none">
                <Maximize size={16} />
                Edit & Annotate Image
             </Button>
          </div>
        )}
      </div>
      
      {showMannequinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowMannequinModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Mockup Generator</p>
                <h3 className="font-serif text-2xl text-gray-900">Create Invisible Mannequin</h3>
              </div>
              <button onClick={() => setShowMannequinModal(false)} className="p-2 hover:bg-gray-50 rounded-full text-gray-500 hover:text-black transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="aspect-[3/4] bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center relative">
                    <img src={mannequinResultImage || imageUrl} className="w-full h-full object-contain p-2" />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block">Gender</label>
                      <select
                        value={mannequinGender}
                        onChange={e => setMannequinGender(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-black transition-all appearance-none cursor-pointer"
                      >
                        <option value="Man">Man</option>
                        <option value="Woman">Woman</option>
                        <option value="Unisex">Unisex</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block">Garment Type</label>
                      <select
                        value={mannequinGarmentType}
                        onChange={e => setMannequinGarmentType(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-black transition-all appearance-none cursor-pointer"
                      >
                        <option value="T-Shirt">T-Shirt</option>
                        <option value="Hoodie">Hoodie</option>
                        <option value="Polo">Polo</option>
                        <option value="Pants">Pants</option>
                        <option value="Shorts">Shorts</option>
                        <option value="Swimwear">Swimwear</option>
                        <option value="Hats">Hats</option>
                        <option value="Outerwear">Outerwear</option>
                        <option value="Quarter Zip">Quarter Zip</option>
                        <option value="Long Sleeve">Long Sleeve</option>
                        <option value="Tank Top">Tank Top</option>
                        <option value="Skirt">Skirt</option>
                        <option value="Romper">Romper</option>
                        <option value="Dress">Dress</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block">Viewpoint</label>
                      <select
                        value={mannequinViewPoint}
                        onChange={e => setMannequinViewPoint(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-black transition-all appearance-none cursor-pointer"
                      >
                        <option value="Front View">Front View</option>
                        <option value="Back View">Back View</option>
                        <option value="Right Side View">Right Side View</option>
                        <option value="Left Side View">Left Side View</option>
                      </select>
                    </div>
                  </div>

                  {mannequinError && (
                    <p className="text-red-500 text-xs font-medium">{mannequinError}</p>
                  )}

                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <Button
                      onClick={handleGenerateMannequin}
                      disabled={isGeneratingMannequin}
                      isLoading={isGeneratingMannequin}
                      className="w-full bg-black text-white py-3 rounded-full text-xs uppercase tracking-widest font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} /> {isGeneratingMannequin ? 'Generating...' : (mannequinResultImage ? 'Regenerate' : 'Create 3D Floating Garment')}
                    </Button>

                    {mannequinResultImage && onSaveMannequinImage && (
                      <Button
                        onClick={async () => {
                          try {
                            setIsSavingMannequin(true);
                            await onSaveMannequinImage(mannequinResultImage);
                            setShowMannequinModal(false);
                            setMannequinResultImage(null);
                          } catch (err: any) {
                            setMannequinError(err.message || 'Failed to save image.');
                          } finally {
                            setIsSavingMannequin(false);
                          }
                        }}
                        disabled={isSavingMannequin}
                        isLoading={isSavingMannequin}
                        className="w-full bg-emerald-600 border border-emerald-600 text-white py-3 rounded-full text-xs uppercase tracking-widest font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                      >
                        Add to Garment Images
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
