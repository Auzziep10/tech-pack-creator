import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Sparkles, 
  Wand2, 
  Undo, 
  Undo2, 
  Redo2, 
  RotateCcw, 
  Trash2, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ArrowLeftRight, 
  Paintbrush,
  History,
  Check
} from 'lucide-react';
import { Button } from '../ui/Button';
import { modifyGarmentRegion } from '../../services/nanobananaService';
import { downloadAsLargePng } from '../../utils/imageDownloader';

interface AIModifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSaveImage: (newImageUrl: string) => Promise<void>;
}

const INSPIRATION_PROMPTS = [
  "Change collar to a thick ribbed knit crewneck",
  "Add a zippered kangaroo pocket with metallic zipper",
  "Convert sleeves to raglan style with contrast piping",
  "Add heavy vintage distressed fading and frayed hems",
  "Add a clean tactical chest flap pocket with snap button",
  "Change neckline to a relaxed open polo collar",
  "Add contrast side panel inserts with flatlock stitching",
  "Replace hem with wide elasticated ribbing"
];

export function AIModifyModal({ isOpen, onClose, imageUrl, onSaveImage }: AIModifyModalProps) {
  const [prompt, setPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(36);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [strokeHistory, setStrokeHistory] = useState<ImageData[]>([]);
  
  // Multi-step modification history stack
  const [historyStack, setHistoryStack] = useState<string[]>([imageUrl]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [showOriginalPreview, setShowOriginalPreview] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const currentGarmentImage = showOriginalPreview 
    ? imageUrl 
    : (historyStack[historyIndex] || imageUrl);

  // Initialize canvas coordinates directly to match image natural resolution
  const handleImageLoaded = () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const natW = img.naturalWidth || 1000;
    const natH = img.naturalHeight || 1000;

    canvas.width = natW;
    canvas.height = natH;
    setIsCanvasReady(true);
  };

  useEffect(() => {
    if (!isOpen) {
      setHistoryStack([imageUrl]);
      setHistoryIndex(0);
      setShowOriginalPreview(false);
      setPrompt('');
      setError(null);
      setStrokeCount(0);
      setStrokeHistory([]);
      setIsCanvasReady(false);
    } else {
      setHistoryStack([imageUrl]);
      setHistoryIndex(0);
      setShowOriginalPreview(false);
      // Check if image is already cached/complete
      if (imageRef.current && imageRef.current.complete) {
        handleImageLoaded();
      }
      const t1 = setTimeout(handleImageLoaded, 100);
      const t2 = setTimeout(handleImageLoaded, 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isOpen, imageUrl]);

  const saveStateToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setStrokeHistory(prev => [...prev.slice(-15), currentData]);
  };

  const handleUndoStroke = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokeHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = [...strokeHistory];
    newHistory.pop();
    const previousState = newHistory[newHistory.length - 1];
    
    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
      setStrokeHistory(newHistory);
      setStrokeCount(prev => Math.max(1, prev - 1));
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setStrokeHistory([]);
      setStrokeCount(0);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStrokeHistory([]);
    setStrokeCount(0);
  };

  // Step Management: Take away or redo modifications
  const handleUndoStep = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      clearCanvas();
      setError(null);
    }
  };

  const handleRedoStep = () => {
    if (historyIndex < historyStack.length - 1) {
      setHistoryIndex(prev => prev + 1);
      clearCanvas();
      setError(null);
    }
  };

  const handleRevertAll = () => {
    setHistoryIndex(0);
    clearCanvas();
    setError(null);
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, scale: 1 };
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return {
      x: (e.clientX - rect.left) * scale,
      y: (e.clientY - rect.top) * scale,
      scale
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isGenerating || showOriginalPreview) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveStateToHistory();

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setStrokeCount(prev => prev + 1);

    const pos = getCanvasCoords(e);
    lastPointRef.current = { x: pos.x, y: pos.y };

    const effectiveBrush = brushSize * pos.scale;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, effectiveBrush / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.65)'; // High-visibility translucent red
    ctx.fill();
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current || isGenerating || showOriginalPreview) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasCoords(e);
    const effectiveBrush = brushSize * pos.scale;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
    ctx.lineWidth = effectiveBrush;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPointRef.current = { x: pos.x, y: pos.y };
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas && e.pointerId) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const handleGenerate = async () => {
    if (strokeCount === 0) {
      setError('Please draw directly on the garment above to highlight the area you want to change.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter instructions underneath describing what to change in the highlighted area.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const drawnCanvas = canvasRef.current;
      if (!drawnCanvas) throw new Error('Canvas not ready');

      // Create full-resolution mask: pure white background (#FFFFFF) with solid black strokes (#000000)
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = drawnCanvas.width;
      maskCanvas.height = drawnCanvas.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) throw new Error('Could not create mask context');

      // 1. Fill solid white
      maskCtx.fillStyle = '#FFFFFF';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

      // 2. Draw user strokes in solid black
      const tempStrokes = document.createElement('canvas');
      tempStrokes.width = drawnCanvas.width;
      tempStrokes.height = drawnCanvas.height;
      const tempCtx = tempStrokes.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(drawnCanvas, 0, 0);
        tempCtx.globalCompositeOperation = 'source-in';
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(0, 0, tempStrokes.width, tempStrokes.height);
      }

      maskCtx.drawImage(tempStrokes, 0, 0);
      const maskBase64 = maskCanvas.toDataURL('image/png');

      const currentBaseImage = historyStack[historyIndex] || imageUrl;
      const result = await modifyGarmentRegion(currentBaseImage, maskBase64, prompt);

      const nextStack = [...historyStack.slice(0, historyIndex + 1), result];
      setHistoryStack(nextStack);
      setHistoryIndex(nextStack.length - 1);
      setShowOriginalPreview(false);
      clearCanvas();
      setPrompt('');
    } catch (err: any) {
      console.error('Modify Error:', err);
      setError(err?.message || 'Failed to modify garment area. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    const finalImage = historyStack[historyIndex];
    if (!finalImage || historyIndex === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      await onSaveImage(finalImage);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save modified garment.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex flex-col p-0 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white border-0 sm:border border-slate-200 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-5xl mx-auto flex flex-col h-full sm:max-h-[94vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center shadow-xs">
              <Wand2 size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-base sm:text-lg text-slate-900 font-bold tracking-wide">Draw on Garment to Modify</h3>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">Studio</span>
                {historyIndex > 0 && (
                  <span className="text-[10px] font-bold tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {historyIndex} Change{historyIndex > 1 ? 's' : ''} Applied
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Paint over any part of the garment to make changes. Add or take away modifications anytime.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Main Body: Vertical Layout (Garment Canvas on Top, Prompt Underneath) */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50">
          
          {/* Garment Drawing Artboard */}
          <div className="flex-1 relative flex flex-col items-center justify-center p-3 sm:p-4 min-h-[300px] overflow-hidden bg-slate-50 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
            
            {/* Top helper notification banner */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-md border border-slate-200 px-3.5 py-1 rounded-full text-slate-700 text-xs flex items-center gap-2 shadow-md">
                <Paintbrush size={13} className="text-purple-600" />
                <span>
                  {showOriginalPreview
                    ? 'Comparing against original untouched photo'
                    : strokeCount > 0
                    ? `${strokeCount} area${strokeCount > 1 ? 's' : ''} marked on garment`
                    : historyIndex > 0
                    ? 'Brush another area to add more changes, or undo below to take away'
                    : 'Click & drag on garment to highlight target area'}
                </span>
              </div>
            </div>

            {/* Canvas Container with Garment Image and Drawing Layer */}
            <div className="relative inline-block select-none shadow-xl border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[50vh] max-w-full">
              <img 
                ref={imageRef}
                src={currentGarmentImage} 
                alt="Garment Artboard"
                onLoad={handleImageLoaded}
                draggable={false}
                className="block max-h-[50vh] w-auto max-w-full object-contain pointer-events-none"
              />

              {/* Mask Drawing Canvas Layer */}
              {!showOriginalPreview && !isGenerating && (
                <canvas 
                  ref={canvasRef}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  style={{ touchAction: 'none' }}
                  className="absolute inset-0 w-full h-full cursor-crosshair z-10"
                />
              )}

              {/* Generating Loading Overlay */}
              {isGenerating && (
                <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in">
                  <div className="relative mb-3">
                    <div className="w-14 h-14 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
                    <Sparkles className="w-5 h-5 text-purple-600 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <h4 className="text-slate-900 font-bold text-base mb-1">Applying Modification...</h4>
                  <p className="text-slate-500 text-xs max-w-xs">
                    Weaving requested changes into fabric weave, folds, and lighting
                  </p>
                </div>
              )}
            </div>

            {/* Floating Action Controls on Artboard */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-slate-200 px-3.5 py-1.5 rounded-full shadow-lg z-20 text-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Brush</span>
                <input 
                  type="range" 
                  min="12" 
                  max="90" 
                  value={brushSize} 
                  onChange={e => setBrushSize(Number(e.target.value))}
                  disabled={showOriginalPreview}
                  className="w-16 sm:w-24 accent-purple-600 cursor-pointer disabled:opacity-40"
                />
                <span className="text-[11px] text-slate-700 font-mono w-5 text-right">{brushSize}px</span>
              </div>

              <div className="h-4 w-px bg-slate-200" />

              <button 
                onClick={handleUndoStroke} 
                disabled={strokeHistory.length === 0 || showOriginalPreview}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-30 cursor-pointer"
                title="Undo last stroke"
              >
                <Undo size={14} />
              </button>

              <button 
                onClick={clearCanvas} 
                disabled={strokeCount === 0 || showOriginalPreview}
                className="p-1 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors disabled:opacity-30 cursor-pointer"
                title="Clear current brush strokes"
              >
                <Trash2 size={14} />
              </button>

              {historyIndex > 0 && (
                <>
                  <div className="h-4 w-px bg-slate-200" />
                  <button
                    onClick={() => setShowOriginalPreview(prev => !prev)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      showOriginalPreview 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Toggle comparison with original photo"
                  >
                    <ArrowLeftRight size={13} />
                    <span>{showOriginalPreview ? 'Show Current' : 'Original'}</span>
                  </button>
                </>
              )}

              <div className="h-4 w-px bg-slate-200" />
              <button
                onClick={async () => {
                  if (isDownloading) return;
                  setIsDownloading(true);
                  try {
                    await downloadAsLargePng(currentGarmentImage, `modified_garment_step_${historyIndex}`, { resolution: 'large' });
                  } catch (e) {
                    alert('Download failed');
                  } finally {
                    setIsDownloading(false);
                  }
                }}
                className="flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900 font-medium px-1.5 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                title="Download PNG of current garment"
              >
                {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                <span className="hidden sm:inline">PNG</span>
              </button>
            </div>
          </div>

          {/* Underneath Controls Section (Prompt Input, Revision Toolbar & Actions) */}
          <div className="border-t border-slate-200 p-4 sm:p-5 bg-white shrink-0 space-y-3">
            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                {error}
              </div>
            )}

            {/* Step Revision Toolbar (add / take away changes) */}
            {historyIndex > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-purple-50/70 border border-purple-200/80 rounded-xl text-xs text-purple-900 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="font-bold flex items-center gap-1.5 text-purple-700">
                    <CheckCircle2 size={15} className="text-purple-600" />
                    <span>Revision {historyIndex} of {historyStack.length - 1} applied</span>
                  </span>
                  <span className="text-purple-300">•</span>
                  <span className="text-purple-600/80 text-[11px] hidden sm:inline">
                    {strokeCount > 0 ? "Brush strokes ready — type prompt below" : "Draw on garment above to add another modification"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleUndoStep}
                    disabled={historyIndex === 0 || isGenerating}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-purple-100/70 border border-purple-200 text-purple-800 rounded-lg font-semibold text-[11px] transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                    title="Take away the last modification"
                  >
                    <Undo2 size={13} />
                    <span>Undo Step</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRedoStep}
                    disabled={historyIndex >= historyStack.length - 1 || isGenerating}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-purple-100/70 border border-purple-200 text-purple-800 rounded-lg font-semibold text-[11px] transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                    title="Redo next modification"
                  >
                    <Redo2 size={13} />
                    <span>Redo</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRevertAll}
                    disabled={historyIndex === 0 || isGenerating}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-600 hover:text-red-600 rounded-lg font-semibold text-[11px] transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                    title="Revert all changes and restore original photo"
                  >
                    <RotateCcw size={13} />
                    <span>Revert All</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {/* Prompt Row with Generate Button & Save to Tech Pack */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && strokeCount > 0 && prompt.trim() && !isGenerating) {
                        handleGenerate();
                      }
                    }}
                    placeholder={
                      strokeCount > 0 
                        ? "Describe how to change the drawn area (e.g. Change collar to ribbed knit, add kangaroo pocket)..." 
                        : historyIndex > 0
                        ? "Draw another area on the garment above to add another modification..."
                        : "1. Draw on the garment above to mark the area -> 2. Type your prompt here..."
                    }
                    disabled={isGenerating || showOriginalPreview}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all disabled:opacity-50"
                  />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || strokeCount === 0 || !prompt.trim()}
                  isLoading={isGenerating}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-xs uppercase tracking-widest font-bold shadow-md shadow-purple-600/20 transition-all flex items-center justify-center gap-2 border-0 shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles size={15} />
                  {isGenerating ? 'Applying...' : historyIndex > 0 ? 'Apply Another Change' : 'Apply Modification'}
                </Button>

                {historyIndex > 0 && (
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || isGenerating}
                    isLoading={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl text-xs uppercase tracking-widest font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 border-0 shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 size={15} />
                    {isSaving ? 'Saving...' : `Save to Tech Pack (${historyIndex})`}
                  </Button>
                )}
              </div>

              {/* Quick Suggestions Chips underneath */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Suggestions:</span>
                {INSPIRATION_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(item)}
                    className="whitespace-nowrap text-[11px] bg-slate-100 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 text-slate-600 border border-slate-200/80 rounded-lg px-2.5 py-1 transition-all shrink-0 cursor-pointer"
                  >
                    + {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
