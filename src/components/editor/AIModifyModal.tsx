import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Wand2, Undo, Trash2, Download, CheckCircle2, Loader2, ArrowLeftRight } from 'lucide-react';
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
  const [brushSize, setBrushSize] = useState(35);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnMask, setHasDrawnMask] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'result' | 'original'>('result');
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize and synchronize canvas dimensions with the rendered image
  const syncCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // Set canvas coordinate space to match image display size
      if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
        clearCanvas();
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setResultImage(null);
      setPrompt('');
      setError(null);
      setHasDrawnMask(false);
      setHistory([]);
    }
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener('resize', syncCanvas);
    return () => window.removeEventListener('resize', syncCanvas);
  }, []);

  const saveStateToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(-15), currentData]); // Keep last 15 states
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const previousState = newHistory[newHistory.length - 1];
    
    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
      setHistory(newHistory);
      setHasDrawnMask(true);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHistory([]);
      setHasDrawnMask(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
    setHasDrawnMask(false);
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (resultImage) return; // Don't draw over result until reset
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveStateToHistory();

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setHasDrawnMask(true);

    const pos = getCanvasCoords(e);
    lastPointRef.current = pos;

    // Draw single dot on tap
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.55)'; // Semi-transparent vibrant red for clear visual feedback
    ctx.fill();
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current || resultImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPointRef.current = pos;
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

  // Generate inpainting mask mapped to original garment image dimensions
  const handleGenerate = async () => {
    if (!hasDrawnMask) {
      setError('Please brush over the area of the garment you would like to modify.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter a prompt describing what to change.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const displayCanvas = canvasRef.current;
      if (!displayCanvas) throw new Error('Canvas not initialized');

      // Load original image to obtain true natural dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });

      // Create full-resolution mask canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = img.naturalWidth;
      maskCanvas.height = img.naturalHeight;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) throw new Error('Could not create mask context');

      // Step 1: Fill with pure white (#FFFFFF)
      maskCtx.fillStyle = '#FFFFFF';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

      // Step 2: Draw the user strokes in pure solid black (#000000)
      // We read the alpha channel from displayCanvas to map drawn pixels
      const displayCtx = displayCanvas.getContext('2d');
      if (!displayCtx) throw new Error('Display context not found');

      const tempStrokesCanvas = document.createElement('canvas');
      tempStrokesCanvas.width = displayCanvas.width;
      tempStrokesCanvas.height = displayCanvas.height;
      const tempCtx = tempStrokesCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(displayCanvas, 0, 0);
        // Replace any drawn non-transparent pixels with pure solid black
        tempCtx.globalCompositeOperation = 'source-in';
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(0, 0, tempStrokesCanvas.width, tempStrokesCanvas.height);
      }

      // Draw onto the full-resolution mask canvas
      maskCtx.drawImage(tempStrokesCanvas, 0, 0, maskCanvas.width, maskCanvas.height);

      const maskBase64 = maskCanvas.toDataURL('image/png');

      // Call inpaint endpoint
      const result = await modifyGarmentRegion(imageUrl, maskBase64, prompt);
      setResultImage(result);
      setPreviewMode('result');
    } catch (err: any) {
      console.error('Modify Error:', err);
      setError(err?.message || 'Failed to modify garment area. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!resultImage) return;
    setIsSaving(true);
    try {
      await onSaveImage(resultImage);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save modified garment.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[260] flex flex-col p-0 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-neutral-900 border-0 sm:border border-white/10 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-6xl mx-auto flex flex-col h-full sm:max-h-[92vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Wand2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl text-white font-bold tracking-wide">Area Inpainting & Modification</h3>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">Studio</span>
              </div>
              <p className="text-xs text-white/50">Brush over any garment area to alter and restyle it seamlessly</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-neutral-950">
          {/* Canvas Area */}
          <div className="flex-1 relative flex flex-col items-center justify-center p-4 min-h-[350px] overflow-hidden bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px]">
            <div 
              ref={containerRef}
              className="relative max-w-full max-h-full flex items-center justify-center select-none shadow-2xl rounded-2xl overflow-hidden bg-white"
            >
              <img 
                ref={imageRef}
                src={previewMode === 'result' && resultImage ? resultImage : imageUrl} 
                alt="Garment Target"
                onLoad={syncCanvas}
                draggable={false}
                className="max-h-[60vh] max-w-full object-contain pointer-events-none"
              />

              {/* Mask Drawing Canvas Layer */}
              {!resultImage && (
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
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                    <Sparkles className="w-6 h-6 text-purple-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">Applying Modification...</h4>
                  <p className="text-white/60 text-xs max-w-xs">
                    Weaving your requested changes into the fabric texture, seams, and lighting
                  </p>
                </div>
              )}
            </div>

            {/* Floating Canvas Controls */}
            {!resultImage ? (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-neutral-900/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-2xl z-20">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Brush</span>
                  <input 
                    type="range" 
                    min="10" 
                    max="90" 
                    value={brushSize} 
                    onChange={e => setBrushSize(Number(e.target.value))}
                    className="w-24 sm:w-32 accent-purple-500 cursor-pointer"
                  />
                  <span className="text-xs text-white/80 font-mono w-6 text-right">{brushSize}px</span>
                </div>

                <div className="h-4 w-px bg-white/20" />

                <button 
                  onClick={handleUndo} 
                  disabled={history.length === 0}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Undo last stroke"
                >
                  <Undo size={16} />
                </button>

                <button 
                  onClick={clearCanvas} 
                  disabled={!hasDrawnMask}
                  className="p-1.5 hover:bg-red-500/20 rounded-lg text-white/70 hover:text-red-400 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Clear mask"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-2xl z-20">
                <button
                  onClick={() => setPreviewMode(m => m === 'result' ? 'original' : 'result')}
                  className="flex items-center gap-1.5 text-xs text-white/90 hover:text-white font-medium px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                >
                  <ArrowLeftRight size={14} />
                  <span>{previewMode === 'result' ? 'Show Original' : 'Show Result'}</span>
                </button>
                <div className="h-4 w-px bg-white/20" />
                <button
                  onClick={async () => {
                    if (isDownloading) return;
                    setIsDownloading(true);
                    try {
                      await downloadAsLargePng(resultImage, 'modified_garment', { resolution: 'large' });
                    } catch (e) {
                      alert('Download failed');
                    } finally {
                      setIsDownloading(false);
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-white/90 hover:text-white font-medium px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                >
                  {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>Download PNG</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Control Sidebar */}
          <div className="w-full md:w-88 border-t md:border-t-0 md:border-l border-white/10 p-5 flex flex-col justify-between bg-neutral-900 overflow-y-auto space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-white/60 mb-1.5 block">
                  Modification Prompt
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. Change collar to ribbed knit crewneck, or add a zippered pocket..."
                  disabled={isGenerating || !!resultImage}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30 focus:border-purple-500 focus:outline-none transition-all resize-none disabled:opacity-50"
                />
              </div>

              {!resultImage && (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">
                    Quick Suggestions
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {INSPIRATION_PROMPTS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPrompt(item)}
                        className="text-left text-[11px] bg-white/5 hover:bg-purple-500/20 hover:border-purple-500/40 text-white/70 hover:text-white border border-white/5 rounded-lg px-2.5 py-1.5 transition-all"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                  {error}
                </div>
              )}

              {resultImage && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-purple-400" />
                  <span>Garment modified successfully! Review the result and save to your tech pack.</span>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-4 border-t border-white/10">
              {!resultImage ? (
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !hasDrawnMask || !prompt.trim()}
                  isLoading={isGenerating}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3 rounded-full text-xs uppercase tracking-widest font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 border-0"
                >
                  <Sparkles size={15} />
                  {isGenerating ? 'Applying Changes...' : 'Apply Changes'}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    isLoading={isSaving}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-full text-xs uppercase tracking-widest font-bold shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 border-0"
                  >
                    <CheckCircle2 size={15} />
                    {isSaving ? 'Saving...' : 'Save to Tech Pack'}
                  </Button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResultImage(null);
                        clearCanvas();
                      }}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      Redraw Mask
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="flex-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={13} />
                      Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
