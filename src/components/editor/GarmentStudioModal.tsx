import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Sparkles, 
  Wand2, 
  Undo2, 
  Redo2, 
  RotateCcw, 
  Trash2, 
  Download, 
  CheckCircle2, 
  Loader2, 
  ArrowLeftRight, 
  Paintbrush,
  Layers,
  UploadCloud,
  Scissors,
  Check
} from 'lucide-react';
import { Button } from '../ui/Button';
import { modifyGarmentRegion, bakeGarmentLogo } from '../../services/nanobananaService';
import { downloadAsLargePng } from '../../utils/imageDownloader';
import { GraphicEditorModal } from './GraphicEditorModal';

interface GarmentStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSaveImage: (newImageUrl: string) => Promise<void>;
  initialTab?: 'modify' | 'bake';
}

type StudioTab = 'modify' | 'bake';
type PrintStyle = 'Screenprint' | 'Embroidered' | 'Vintage Distressed' | 'Direct to Garment' | 'Rubberized Heat Transfer' | 'Puff Print';

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

const PRINT_STYLES: { id: PrintStyle; label: string; desc: string }[] = [
  { id: 'Screenprint', label: 'Screenprint', desc: 'Flat ink with crisp edges and soft fabric texture' },
  { id: 'Embroidered', label: 'Embroidered', desc: 'Raised stitching, thread sheen, and tactile embroidery depth' },
  { id: 'Vintage Distressed', label: 'Vintage Distressed', desc: 'Weathered cracks, washed-out tones, and aged fabric fade' },
  { id: 'Direct to Garment', label: 'Direct to Garment', desc: 'Natural water-based ink seamlessly absorbed into cotton knit' },
  { id: 'Rubberized Heat Transfer', label: 'Rubberized Heat Transfer', desc: 'Smooth semi-gloss vinyl flex with clean raised boundaries' },
  { id: 'Puff Print', label: 'Puff Print', desc: 'Thick 3D foam puff ink rising proudly off the garment surface' }
];

export function GarmentStudioModal({
  isOpen,
  onClose,
  imageUrl,
  onSaveImage,
  initialTab = 'modify'
}: GarmentStudioModalProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab);

  // Shared revision history stack
  const [historyStack, setHistoryStack] = useState<string[]>([imageUrl]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [showOriginalPreview, setShowOriginalPreview] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Current active garment image
  const currentGarmentImage = showOriginalPreview 
    ? imageUrl 
    : (historyStack[historyIndex] || imageUrl);

  // ----------------------------------------------------
  // MODIFY TAB STATES
  // ----------------------------------------------------
  const [prompt, setPrompt] = useState<string>('');
  const [brushSize, setBrushSize] = useState<number>(36);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [strokeHistory, setStrokeHistory] = useState<ImageData[]>([]);
  const [isCanvasReady, setIsCanvasReady] = useState<boolean>(false);

  const garmentImgRef = useRef<HTMLImageElement>(null);
  const modifyCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // ----------------------------------------------------
  // BAKE TAB STATES & PHOTOSHOP TRANSFORM
  // ----------------------------------------------------
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string>('');
  const [showGraphicEditor, setShowGraphicEditor] = useState<boolean>(false);
  const [posX, setPosX] = useState<number>(0); // -45 to 45%
  const [posY, setPosY] = useState<number>(-8); // -45 to 45%
  const [scale, setScale] = useState<number>(26); // 5 to 75%
  const [rotation, setRotation] = useState<number>(0);
  const [printStyle, setPrintStyle] = useState<PrintStyle>('Screenprint');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const artboardContainerRef = useRef<HTMLDivElement>(null);
  const logoTransformRef = useRef<HTMLDivElement>(null);
  const transformStartRef = useRef<{
    action: string;
    clientX: number;
    clientY: number;
    initPosX: number;
    initPosY: number;
    initScale: number;
    initRotation: number;
    centerX: number;
    centerY: number;
    initDistance: number;
    initAngle: number;
  } | null>(null);

  // Sync initial tab and reset when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setHistoryStack([imageUrl]);
      setHistoryIndex(0);
      setShowOriginalPreview(false);
      setPrompt('');
      setError(null);
      setStrokeCount(0);
      setStrokeHistory([]);
      setIsCanvasReady(false);
    }
  }, [isOpen, imageUrl, initialTab]);

  // Adjust modify canvas size to match garment natural dimensions
  const handleGarmentImageLoaded = () => {
    const img = garmentImgRef.current;
    const canvas = modifyCanvasRef.current;
    if (!img || !canvas) return;

    canvas.width = img.naturalWidth || 1000;
    canvas.height = img.naturalHeight || 1000;
    setIsCanvasReady(true);
  };

  useEffect(() => {
    if (isOpen && garmentImgRef.current?.complete) {
      handleGarmentImageLoaded();
    }
    const t = setTimeout(handleGarmentImageLoaded, 150);
    return () => clearTimeout(t);
  }, [isOpen, currentGarmentImage, activeTab]);

  // ----------------------------------------------------
  // MODIFY BRUSH LOGIC
  // ----------------------------------------------------
  const saveStrokeState = () => {
    const canvas = modifyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setStrokeHistory(prev => [...prev.slice(-15), currentData]);
  };

  const handleUndoStroke = () => {
    const canvas = modifyCanvasRef.current;
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

  const clearModifyCanvas = () => {
    const canvas = modifyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStrokeHistory([]);
    setStrokeCount(0);
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = modifyCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleBrushDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (showOriginalPreview || isProcessing) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    saveStrokeState();
    setIsDrawing(true);
    lastPointRef.current = coords;

    const canvas = modifyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const currentScale = canvas.width / (rect.width || 1);
    const actualRadius = (brushSize * currentScale) / 2;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, actualRadius, 0, Math.PI * 2);
    ctx.fill();

    setStrokeCount(c => c + 1);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleBrushMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current || isProcessing) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    const canvas = modifyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const currentScale = canvas.width / (rect.width || 1);
    const actualLineWidth = brushSize * currentScale;

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = actualLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
  };

  const handleBrushUp = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  // Generate modification using painted mask and prompt
  const handleApplyModification = async () => {
    if (strokeCount === 0) {
      setError('Please draw on the garment first to mark the area you want to change.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter a description for the modification.');
      return;
    }

    const canvas = modifyCanvasRef.current;
    if (!canvas) return;

    // Create binary black & white mask
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;

    mCtx.fillStyle = '#000000';
    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    const drawCtx = canvas.getContext('2d');
    if (drawCtx) {
      const imgData = drawCtx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const maskData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const mData = maskData.data;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 10) {
          mData[i] = 255;
          mData[i + 1] = 255;
          mData[i + 2] = 255;
          mData[i + 3] = 255;
        }
      }
      mCtx.putImageData(maskData, 0, 0);
    }

    const maskBase64 = maskCanvas.toDataURL('image/png');

    setIsProcessing(true);
    setError(null);

    try {
      const resultImageUrl = await modifyGarmentRegion(currentGarmentImage, maskBase64, prompt.trim());
      const nextStack = [...historyStack.slice(0, historyIndex + 1), resultImageUrl];
      setHistoryStack(nextStack);
      setHistoryIndex(nextStack.length - 1);
      clearModifyCanvas();
      setPrompt('');
    } catch (err: any) {
      setError(err?.message || 'Failed to apply modification. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ----------------------------------------------------
  // PHOTOSHOP-STYLE INTERACTIVE LOGO TRANSFORM
  // ----------------------------------------------------
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, SVG, or JPG).');
      return;
    }

    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setLogoSrc(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // 1. Move logo by dragging body
  const handleLogoMoveDown = (e: React.PointerEvent) => {
    if (!logoSrc || isProcessing) return;
    e.stopPropagation();
    transformStartRef.current = {
      action: 'move',
      clientX: e.clientX,
      clientY: e.clientY,
      initPosX: posX,
      initPosY: posY,
      initScale: scale,
      initRotation: rotation,
      centerX: 0,
      centerY: 0,
      initDistance: 0,
      initAngle: 0
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  // 2. Proportional scale by dragging any corner handle
  const handleCornerResizeDown = (corner: string, e: React.PointerEvent) => {
    if (!logoSrc || isProcessing || !logoTransformRef.current) return;
    e.stopPropagation();
    const rect = logoTransformRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const initDistance = Math.hypot(e.clientX - centerX, e.clientY - centerY);

    transformStartRef.current = {
      action: corner,
      clientX: e.clientX,
      clientY: e.clientY,
      initPosX: posX,
      initPosY: posY,
      initScale: scale,
      initRotation: rotation,
      centerX,
      centerY,
      initDistance,
      initAngle: 0
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  // 3. Rotate logo by dragging top stem handle
  const handleRotateDown = (e: React.PointerEvent) => {
    if (!logoSrc || isProcessing || !logoTransformRef.current) return;
    e.stopPropagation();
    const rect = logoTransformRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const initAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    transformStartRef.current = {
      action: 'rotate',
      clientX: e.clientX,
      clientY: e.clientY,
      initPosX: posX,
      initPosY: posY,
      initScale: scale,
      initRotation: rotation,
      centerX,
      centerY,
      initDistance: 0,
      initAngle
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  // 4. Combined pointer move for move / scale / rotate
  const handleTransformPointerMove = (e: React.PointerEvent) => {
    if (!transformStartRef.current) return;
    const { action, clientX, clientY, initPosX, initPosY, initScale, initRotation, centerX, centerY, initDistance, initAngle } = transformStartRef.current;

    if (action === 'move') {
      if (!artboardContainerRef.current) return;
      const rect = artboardContainerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const deltaX = ((e.clientX - clientX) / rect.width) * 100;
      const deltaY = ((e.clientY - clientY) / rect.height) * 100;
      const newX = Math.max(-45, Math.min(45, initPosX + deltaX));
      const newY = Math.max(-45, Math.min(45, initPosY + deltaY));
      setPosX(Math.round(newX * 10) / 10);
      setPosY(Math.round(newY * 10) / 10);
    } else if (action === 'rotate') {
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      const deltaAngle = currentAngle - initAngle;
      let newRot = Math.round((initRotation + deltaAngle) % 360);
      if (newRot > 180) newRot -= 360;
      if (newRot < -180) newRot += 360;
      if (e.shiftKey) newRot = Math.round(newRot / 15) * 15; // Shift to snap to 15 degrees
      setRotation(newRot);
    } else if (action.startsWith('scale')) {
      const currentDistance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      const ratio = currentDistance / (initDistance || 1);
      const newScale = Math.max(5, Math.min(80, Math.round(initScale * ratio * 10) / 10));
      setScale(newScale);
    }
  };

  const handleTransformPointerUp = () => {
    transformStartRef.current = null;
  };

  // Create high-res composite and bake realistically
  const handleBakeLogo = async () => {
    if (!logoSrc) {
      setError('Please upload a logo first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const garment = new Image();
      garment.crossOrigin = 'anonymous';
      garment.src = currentGarmentImage;
      await new Promise((res, rej) => {
        garment.onload = res;
        garment.onerror = rej;
      });

      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = logoSrc;
      await new Promise((res, rej) => {
        logo.onload = res;
        logo.onerror = rej;
      });

      const canvas = document.createElement('canvas');
      canvas.width = garment.naturalWidth;
      canvas.height = garment.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create composite canvas');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(garment, 0, 0, canvas.width, canvas.height);

      const logoTargetWidth = (canvas.width * scale) / 100;
      const logoAspect = logo.naturalHeight / (logo.naturalWidth || 1);
      const logoTargetHeight = logoTargetWidth * logoAspect;
      const centerPxX = canvas.width / 2 + (canvas.width * posX) / 100;
      const centerPxY = canvas.height / 2 + (canvas.height * posY) / 100;

      // Mask logo strictly to garment silhouette
      try {
        const gCanvas = document.createElement('canvas');
        gCanvas.width = canvas.width;
        gCanvas.height = canvas.height;
        const gCtx = gCanvas.getContext('2d', { willReadFrequently: true });
        if (gCtx) {
          gCtx.drawImage(garment, 0, 0);
          const imgData = gCtx.getImageData(0, 0, gCanvas.width, gCanvas.height);
          const data = imgData.data;
          const maskImgData = gCtx.createImageData(gCanvas.width, gCanvas.height);
          const md = maskImgData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            const isBg = (r > 248 && g > 248 && b > 248) || a < 20;
            if (!isBg) {
              md[i + 3] = 255;
            } else {
              md[i + 3] = 0;
            }
          }

          const logoLayer = document.createElement('canvas');
          logoLayer.width = canvas.width;
          logoLayer.height = canvas.height;
          const lCtx = logoLayer.getContext('2d');
          if (lCtx) {
            lCtx.save();
            lCtx.translate(centerPxX, centerPxY);
            lCtx.rotate((rotation * Math.PI) / 180);
            lCtx.drawImage(logo, -logoTargetWidth / 2, -logoTargetHeight / 2, logoTargetWidth, logoTargetHeight);
            lCtx.restore();

            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const mCtx = maskCanvas.getContext('2d');
            if (mCtx) {
              mCtx.putImageData(maskImgData, 0, 0);
              lCtx.globalCompositeOperation = 'destination-in';
              lCtx.drawImage(maskCanvas, 0, 0);
            }
            ctx.drawImage(logoLayer, 0, 0);
          }
        }
      } catch (e) {
        ctx.save();
        ctx.translate(centerPxX, centerPxY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(logo, -logoTargetWidth / 2, -logoTargetHeight / 2, logoTargetWidth, logoTargetHeight);
        ctx.restore();
      }

      const compositeBase64 = canvas.toDataURL('image/jpeg', 0.95);
      const bakedResultUrl = await bakeGarmentLogo(compositeBase64, printStyle);

      const nextStack = [...historyStack.slice(0, historyIndex + 1), bakedResultUrl];
      setHistoryStack(nextStack);
      setHistoryIndex(nextStack.length - 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to bake logo into fabric. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ----------------------------------------------------
  // SHARED REVISION CONTROLS
  // ----------------------------------------------------
  const handleUndoStep = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      clearModifyCanvas();
    }
  };

  const handleRedoStep = () => {
    if (historyIndex < historyStack.length - 1) {
      setHistoryIndex(prev => prev + 1);
      clearModifyCanvas();
    }
  };

  const handleRevertAll = () => {
    setHistoryIndex(0);
    clearModifyCanvas();
  };

  const handleSaveToTechPack = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSaveImage(currentGarmentImage);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save garment to Tech Pack.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white border-0 sm:border border-slate-200 rounded-none sm:rounded-3xl shadow-2xl w-full h-full max-w-7xl max-h-[96vh] mx-auto flex flex-col overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header - Monochrome & Clean */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center shadow-xs">
              <Wand2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl text-slate-900 font-bold tracking-tight">Garment Studio</h3>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full">Studio</span>
              </div>
              <p className="text-xs text-slate-500">Modify garment details or position brand graphics and bake them realistically into fabric</p>
            </div>
          </div>

          {/* Center Mode Switcher Tabs - Monochrome Grayscale */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('modify')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'modify'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Paintbrush size={14} />
              <span>Modify Garment</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bake')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'bake'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={14} />
              <span>Place & Bake Logo</span>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {historyIndex > 0 && (
              <button
                type="button"
                onMouseDown={() => setShowOriginalPreview(true)}
                onMouseUp={() => setShowOriginalPreview(false)}
                onMouseLeave={() => setShowOriginalPreview(false)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs text-slate-700 font-semibold transition-colors cursor-pointer"
                title="Hold to preview original untouched garment"
              >
                <ArrowLeftRight size={13} />
                <span>Hold for Original</span>
              </button>
            )}

            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="px-6 py-2 bg-slate-100 border-b border-slate-300 text-slate-800 text-xs flex items-center justify-between shrink-0">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-slate-500 hover:text-slate-900 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Studio Main Workspace */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-slate-50">
          
          {/* Main Interactive Canvas Area */}
          <div className="flex-1 relative flex flex-col items-center justify-center p-4 sm:p-6 min-h-[350px] overflow-hidden bg-slate-50 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
            
            {/* Top helper notification */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-md border border-slate-200 px-4 py-1.5 rounded-full text-slate-800 text-xs flex items-center gap-2 shadow-md">
                {activeTab === 'modify' ? (
                  <>
                    <Sparkles size={13} className="text-slate-800" />
                    <span>Click & drag on garment to highlight target area, then describe changes below</span>
                  </>
                ) : (
                  <>
                    <Layers size={13} className="text-slate-800" />
                    <span>Drag body to move, drag corners to scale, drag top handle to rotate</span>
                  </>
                )}
              </div>
            </div>

            {/* Artboard Container */}
            <div 
              ref={artboardContainerRef}
              onPointerMove={activeTab === 'bake' ? handleTransformPointerMove : undefined}
              onPointerUp={activeTab === 'bake' ? handleTransformPointerUp : undefined}
              onPointerLeave={activeTab === 'bake' ? handleTransformPointerUp : undefined}
              style={{ touchAction: 'none' }}
              className="relative max-w-full max-h-full flex items-center justify-center select-none shadow-xl border border-slate-200 rounded-2xl overflow-hidden bg-white"
            >
              {/* Garment Image */}
              <img 
                ref={garmentImgRef}
                src={currentGarmentImage} 
                alt="Garment Studio Display"
                onLoad={handleGarmentImageLoaded}
                draggable={false}
                className="max-h-[62vh] max-w-full object-contain pointer-events-none block"
              />

              {/* Mode 1: Brush Drawing Canvas Overlay */}
              {activeTab === 'modify' && (
                <canvas
                  ref={modifyCanvasRef}
                  onPointerDown={handleBrushDown}
                  onPointerMove={handleBrushMove}
                  onPointerUp={handleBrushUp}
                  onPointerLeave={handleBrushUp}
                  style={{ touchAction: 'none' }}
                  className="absolute inset-0 w-full h-full cursor-crosshair z-10"
                />
              )}

              {/* Mode 2: Photoshop-Style Interactive Transform Box */}
              {activeTab === 'bake' && logoSrc && (
                <div
                  ref={logoTransformRef}
                  style={{
                    position: 'absolute',
                    left: `${50 + posX}%`,
                    top: `${50 + posY}%`,
                    width: `${scale}%`,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    transformOrigin: 'center center'
                  }}
                  className="z-20 select-none group/transform"
                >
                  <div 
                    onPointerDown={handleLogoMoveDown}
                    className="relative cursor-move select-none"
                  >
                    <img 
                      src={logoSrc} 
                      alt="Logo Overlay" 
                      draggable={false}
                      className="w-full h-auto object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.18)] select-none pointer-events-none block" 
                    />

                    {/* Photoshop Selection Border */}
                    <div className="absolute inset-0 border border-slate-900/60 border-dashed pointer-events-none" />

                    {/* Rotation Stem & Handle (Top Center) */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                      <div
                        onPointerDown={handleRotateDown}
                        className="w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-900 shadow-sm cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                        title="Drag to rotate (Hold Shift to snap to 15°)"
                      />
                      <div className="w-px h-3.5 bg-slate-900/60" />
                    </div>

                    {/* 4 Corner Resize Handles */}
                    <div
                      onPointerDown={e => handleCornerResizeDown('scale-tl', e)}
                      className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-slate-900 shadow-xs cursor-nwse-resize hover:scale-130 transition-transform pointer-events-auto"
                      title="Drag corner to scale"
                    />
                    <div
                      onPointerDown={e => handleCornerResizeDown('scale-tr', e)}
                      className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-slate-900 shadow-xs cursor-nesw-resize hover:scale-130 transition-transform pointer-events-auto"
                      title="Drag corner to scale"
                    />
                    <div
                      onPointerDown={e => handleCornerResizeDown('scale-bl', e)}
                      className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-slate-900 shadow-xs cursor-nesw-resize hover:scale-130 transition-transform pointer-events-auto"
                      title="Drag corner to scale"
                    />
                    <div
                      onPointerDown={e => handleCornerResizeDown('scale-br', e)}
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-slate-900 shadow-xs cursor-nwse-resize hover:scale-130 transition-transform pointer-events-auto"
                      title="Drag corner to scale"
                    />
                  </div>
                </div>
              )}

              {/* Processing Loading Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in">
                  <div className="relative mb-4">
                    <div className="w-14 h-14 rounded-full border-3 border-slate-200 border-t-slate-900 animate-spin" />
                    <Sparkles className="w-5 h-5 text-slate-800 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <h4 className="text-slate-900 font-bold text-base mb-1">
                    {activeTab === 'modify' ? 'Applying Garment Modifications...' : 'Baking Logo Realistically...'}
                  </h4>
                  <p className="text-slate-500 text-xs max-w-xs">
                    {activeTab === 'modify' 
                      ? 'Reconstructing garment pattern, seams, knit texture, and lighting accurately' 
                      : 'Adapting graphic to natural fabric folds, cloth ripples, surface texture, and ambient lighting'}
                  </p>
                </div>
              )}
            </div>

            {/* Floating Toolbar under canvas */}
            {activeTab === 'modify' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/95 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-full shadow-lg z-20">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className="uppercase tracking-wider text-[10px] text-slate-400">Brush</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={brushSize}
                    onChange={e => setBrushSize(Number(e.target.value))}
                    className="w-24 accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                  />
                  <span className="w-9 text-right font-mono text-slate-900 text-xs">{brushSize}px</span>
                </div>

                <div className="h-4 w-px bg-slate-200" />

                <button
                  type="button"
                  onClick={handleUndoStroke}
                  disabled={strokeCount === 0 || isProcessing}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="Undo last stroke"
                >
                  <Undo2 size={14} />
                </button>

                <button
                  type="button"
                  onClick={clearModifyCanvas}
                  disabled={strokeCount === 0 || isProcessing}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="Clear all strokes"
                >
                  <Trash2 size={14} />
                </button>

                <div className="h-4 w-px bg-slate-200" />

                <button
                  type="button"
                  onClick={async () => {
                    if (isDownloading) return;
                    setIsDownloading(true);
                    try {
                      await downloadAsLargePng(currentGarmentImage, 'garment_studio_export', { resolution: 'large' });
                    } catch (e) {
                      alert('Download failed');
                    } finally {
                      setIsDownloading(false);
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 font-semibold px-2 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  <span>PNG</span>
                </button>
              </div>
            )}

            {activeTab === 'bake' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-full shadow-lg z-20">
                <button
                  type="button"
                  onClick={async () => {
                    if (isDownloading) return;
                    setIsDownloading(true);
                    try {
                      await downloadAsLargePng(currentGarmentImage, 'garment_logo_mockup', { resolution: 'large' });
                    } catch (e) {
                      alert('Download failed');
                    } finally {
                      setIsDownloading(false);
                    }
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 font-medium px-2 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>Download PNG</span>
                </button>
              </div>
            )}
          </div>

          {/* Mode 2 Sidebar: Place & Bake Logo Controls - Grayscale */}
          {activeTab === 'bake' && (
            <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200 p-5 flex flex-col justify-between bg-white overflow-y-auto space-y-5">
              <div className="space-y-4">
                {/* Logo File Selector */}
                <div>
                  <label className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2 block">
                    Brand Logo Graphic
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  {!logoSrc ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-4 border-2 border-dashed border-slate-300 hover:border-slate-800 hover:bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer bg-slate-50/50 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                        <UploadCloud size={20} />
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold text-slate-800 block">Upload Logo Graphic</span>
                        <span className="text-[11px] text-slate-500">PNG, SVG, or JPG (High Res)</span>
                      </div>
                    </button>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg border border-slate-200 bg-white p-1 shrink-0 flex items-center justify-center overflow-hidden">
                          <img src={logoSrc} alt="Thumbnail" className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{logoName || 'Custom Graphic'}</p>
                          <p className="text-[10px] text-slate-500 font-semibold">Ready to place</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowGraphicEditor(true)}
                          className="text-[11px] font-bold text-slate-800 hover:text-black px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Remove background colors or crop graphic"
                        >
                          <Scissors size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-200/50 transition-colors cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLogoSrc(null);
                            setLogoName('');
                          }}
                          className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Crop & Remove Background Colors Button */}
                  {logoSrc && (
                    <button
                      type="button"
                      onClick={() => setShowGraphicEditor(true)}
                      className="w-full mt-2 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer group"
                    >
                      <Scissors size={14} className="text-slate-700 group-hover:rotate-12 transition-transform" />
                      <span>Crop & Remove Background Colors</span>
                    </button>
                  )}
                </div>

                {/* Placement Controls (Can also drag corners/body directly on the garment) */}
                {logoSrc && (
                  <div className="space-y-3.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Scale (or drag corners)</span>
                      <span className="text-slate-900 font-mono font-medium">{scale}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="5" 
                      max="75" 
                      value={scale} 
                      onChange={e => setScale(Number(e.target.value))}
                      className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                    />

                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Rotation (or drag top dot)</span>
                      <span className="text-slate-900 font-mono font-medium">{rotation}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="-180" 
                      max="180" 
                      value={rotation} 
                      onChange={e => setRotation(Number(e.target.value))}
                      className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                    />

                    {/* Quick placement presets */}
                    <div className="pt-2">
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1.5">Quick Placement</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setPosX(-18); setPosY(-14); setScale(16); setRotation(0); }}
                          className="py-1 px-1.5 text-[10px] font-semibold bg-slate-50 hover:bg-slate-100 hover:text-slate-900 text-slate-700 border border-slate-200 rounded-md transition-colors"
                        >
                          Left Chest
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPosX(0); setPosY(-8); setScale(26); setRotation(0); }}
                          className="py-1 px-1.5 text-[10px] font-semibold bg-slate-50 hover:bg-slate-100 hover:text-slate-900 text-slate-700 border border-slate-200 rounded-md transition-colors"
                        >
                          Center
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPosX(0); setPosY(-2); setScale(40); setRotation(0); }}
                          className="py-1 px-1.5 text-[10px] font-semibold bg-slate-50 hover:bg-slate-100 hover:text-slate-900 text-slate-700 border border-slate-200 rounded-md transition-colors"
                        >
                          Full Front
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPosX(0); setPosY(-28); setScale(12); setRotation(0); }}
                          className="py-1 px-1.5 text-[10px] font-semibold bg-slate-50 hover:bg-slate-100 hover:text-slate-900 text-slate-700 border border-slate-200 rounded-md transition-colors"
                        >
                          Collar
                        </button>
                      </div>
                    </div>

                    {/* Print Style */}
                    <div className="pt-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2 block">
                        Print Finish & Application
                      </label>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {PRINT_STYLES.map(style => (
                          <div
                            key={style.id}
                            onClick={() => setPrintStyle(style.id)}
                            className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                              printStyle === style.id
                                ? 'bg-slate-100/90 border-slate-800 ring-1 ring-slate-800'
                                : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${printStyle === style.id ? 'text-slate-900' : 'text-slate-700'}`}>
                                {style.label}
                              </span>
                              {printStyle === style.id && <Check size={14} className="text-slate-900" />}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{style.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bake Action Button */}
              {logoSrc && (
                <div className="pt-3 border-t border-slate-200">
                  <Button
                    onClick={handleBakeLogo}
                    disabled={isProcessing}
                    isLoading={isProcessing}
                    className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-full text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 border-0 cursor-pointer"
                  >
                    <Sparkles size={15} />
                    <span>Bake Realistic Mockup</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Studio Controls / Prompt Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white shrink-0 space-y-3">
          
          {/* Revision Banner (when edits exist) - Grayscale */}
          {historyIndex > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="font-bold flex items-center gap-1.5 text-slate-900">
                  <CheckCircle2 size={15} className="text-slate-700" />
                  <span>Revision {historyIndex} of {historyStack.length - 1} applied</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 text-[11px] hidden sm:inline">
                  {activeTab === 'modify' 
                    ? (strokeCount > 0 ? "Brush strokes ready — type prompt below" : "Draw on garment above to add another modification")
                    : "Logo positioned — click Bake Realistic Mockup"}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndoStep}
                  disabled={historyIndex === 0 || isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                  title="Take away the last modification"
                >
                  <Undo2 size={13} />
                  <span>Undo Step</span>
                </button>

                <button
                  type="button"
                  onClick={handleRedoStep}
                  disabled={historyIndex >= historyStack.length - 1 || isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                  title="Redo next modification"
                >
                  <Redo2 size={13} />
                  <span>Redo</span>
                </button>

                <button
                  type="button"
                  onClick={handleRevertAll}
                  disabled={historyIndex === 0 || isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-2xs cursor-pointer"
                  title="Revert all changes and restore original photo"
                >
                  <RotateCcw size={13} />
                  <span>Revert All</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode 1: Prompt Input Row (only in Modify tab) - Grayscale */}
          {activeTab === 'modify' && (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && strokeCount > 0 && prompt.trim() && !isProcessing) {
                        handleApplyModification();
                      }
                    }}
                    placeholder={
                      strokeCount > 0 
                        ? "Describe how to change the drawn area (e.g. Change collar to ribbed knit, add kangaroo pocket)..." 
                        : historyIndex > 0
                        ? "Draw another area on the garment above to add another modification..."
                        : "1. Draw on the garment above to mark the area -> 2. Type your prompt here..."
                    }
                    disabled={isProcessing || showOriginalPreview}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-800 focus:ring-2 focus:ring-slate-100 transition-all disabled:opacity-50"
                  />
                </div>

                <Button
                  onClick={handleApplyModification}
                  disabled={isProcessing || strokeCount === 0 || !prompt.trim()}
                  isLoading={isProcessing}
                  className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl text-xs uppercase tracking-widest font-bold shadow-md transition-all flex items-center justify-center gap-2 border-0 shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles size={15} />
                  {isProcessing ? 'Applying...' : historyIndex > 0 ? 'Apply Another Change' : 'Apply Modification'}
                </Button>

                {historyIndex > 0 && (
                  <Button
                    onClick={handleSaveToTechPack}
                    disabled={isSaving || isProcessing}
                    isLoading={isSaving}
                    className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl text-xs uppercase tracking-widest font-bold shadow-md transition-all flex items-center justify-center gap-2 border-0 shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 size={15} />
                    {isSaving ? 'Saving...' : `Save to Tech Pack (${historyIndex})`}
                  </Button>
                )}
              </div>

              {/* Suggestions Chips - Grayscale */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Suggestions:</span>
                {INSPIRATION_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(item)}
                    className="whitespace-nowrap text-[11px] bg-slate-100 hover:bg-slate-200 hover:text-slate-900 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 transition-all shrink-0 cursor-pointer"
                  >
                    + {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode 2: Bottom Save Bar (when in Bake Logo tab and edits exist) */}
          {activeTab === 'bake' && historyIndex > 0 && (
            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                onClick={handleSaveToTechPack}
                disabled={isSaving || isProcessing}
                isLoading={isSaving}
                className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-full text-xs uppercase tracking-widest font-bold shadow-md transition-all flex items-center justify-center gap-2 border-0 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                {isSaving ? 'Saving...' : `Save to Tech Pack (${historyIndex} revisions)`}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Graphic Editor Modal (InkTheory Manual Background & Color Remover) */}
      {showGraphicEditor && logoSrc && (
        <GraphicEditorModal
          isOpen={showGraphicEditor}
          onClose={() => setShowGraphicEditor(false)}
          imageSrc={logoSrc}
          onApply={(editedSrc) => {
            setLogoSrc(editedSrc);
          }}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
