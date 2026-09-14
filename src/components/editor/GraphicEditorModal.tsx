import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Pipette, 
  Crop, 
  Trash2, 
  Undo, 
  RotateCcw, 
  Check, 
  Sliders, 
  Scissors, 
  SunMedium,
  CheckCircle2,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { Button } from '../ui/Button';

interface RemovedColor {
  id: string;
  r: number;
  g: number;
  b: number;
  hex: string;
}

interface GraphicEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onApply: (editedImageSrc: string) => void;
}

type EditorTab = 'knockout' | 'crop' | 'adjust';

export function GraphicEditorModal({ isOpen, onClose, imageSrc, onApply }: GraphicEditorModalProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('knockout');
  
  // Base working image (after any applied crops or permanent transforms)
  const [baseImageSrc, setBaseImageSrc] = useState<string>(imageSrc);
  const [history, setHistory] = useState<string[]>([]);
  
  // Color Knockout states
  const [removedColors, setRemovedColors] = useState<RemovedColor[]>([]);
  const [tolerance, setTolerance] = useState<number>(22);
  const [feather, setFeather] = useState<number>(4);
  const [isEyedropperActive, setIsEyedropperActive] = useState<boolean>(true);
  
  // Preview Data URL
  const [previewSrc, setPreviewSrc] = useState<string>(imageSrc);

  // Interactive Crop states (percentages 0-100)
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 5,
    y: 5,
    w: 90,
    h: 90
  });
  const [isDraggingCrop, setIsDraggingCrop] = useState<boolean>(false);
  const [activeCropHandle, setActiveCropHandle] = useState<string | null>(null);
  const cropStartRef = useRef<{ clientX: number; clientY: number; initBox: typeof cropBox } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);

  // Reset and load image when modal opens
  useEffect(() => {
    if (isOpen && imageSrc) {
      setBaseImageSrc(imageSrc);
      setPreviewSrc(imageSrc);
      setHistory([]);
      setRemovedColors([]);
      setTolerance(22);
      setFeather(4);
      setActiveTab('knockout');
      setIsEyedropperActive(true);
      setCropBox({ x: 5, y: 5, w: 90, h: 90 });
    }
  }, [isOpen, imageSrc]);

  // Compute Color Knockout Preview whenever baseImageSrc, removedColors, tolerance, or feather changes
  const applyColorKnockout = useCallback(async (baseSrc: string, colors: RemovedColor[], tol: number, fthr: number) => {
    if (colors.length === 0) {
      setPreviewSrc(baseSrc);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = baseSrc;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let minDistance = 999;
      for (const col of colors) {
        const dist = (Math.sqrt((r - col.r) ** 2 + (g - col.g) ** 2 + (b - col.b) ** 2) / 441.67) * 100;
        if (dist < minDistance) {
          minDistance = dist;
        }
      }

      if (minDistance <= tol) {
        data[i + 3] = 0;
      } else if (minDistance < tol + fthr) {
        const factor = (minDistance - tol) / fthr;
        data[i + 3] = Math.round(a * factor);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    setPreviewSrc(canvas.toDataURL('image/png'));
  }, []);

  useEffect(() => {
    applyColorKnockout(baseImageSrc, removedColors, tolerance, feather);
  }, [baseImageSrc, removedColors, tolerance, feather, applyColorKnockout]);

  // Eyedropper click on canvas/image to pick and remove color
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isEyedropperActive || activeTab !== 'knockout') return;
    const img = previewImgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sample from the base image so we get true color values
    const sampleImg = new Image();
    sampleImg.crossOrigin = 'anonymous';
    sampleImg.src = baseImageSrc;
    sampleImg.onload = () => {
      ctx.drawImage(sampleImg, 0, 0);
      const pxX = Math.floor((clickX / rect.width) * img.naturalWidth);
      const pxY = Math.floor((clickY / rect.height) * img.naturalHeight);
      
      const pixel = ctx.getImageData(Math.max(0, Math.min(img.naturalWidth - 1, pxX)), Math.max(0, Math.min(img.naturalHeight - 1, pxY)), 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

      // Check if this color is already removed
      const alreadyRemoved = removedColors.some(c => 
        Math.abs(c.r - r) < 8 && Math.abs(c.g - g) < 8 && Math.abs(c.b - b) < 8
      );

      if (!alreadyRemoved) {
        setRemovedColors(prev => [
          ...prev, 
          { id: `${Date.now()}-${Math.random()}`, r, g, b, hex }
        ]);
      }
    };
  };

  // Quick preset: Remove White Background
  const handleQuickRemoveWhite = () => {
    const hasWhite = removedColors.some(c => c.hex === '#FFFFFF' || (c.r > 240 && c.g > 240 && c.b > 240));
    if (!hasWhite) {
      setRemovedColors(prev => [
        ...prev, 
        { id: `white-${Date.now()}`, r: 255, g: 255, b: 255, hex: '#FFFFFF' }
      ]);
    }
  };

  // Quick preset: Remove Black Background
  const handleQuickRemoveBlack = () => {
    const hasBlack = removedColors.some(c => c.hex === '#000000' || (c.r < 15 && c.g < 15 && c.b < 15));
    if (!hasBlack) {
      setRemovedColors(prev => [
        ...prev, 
        { id: `black-${Date.now()}`, r: 0, g: 0, b: 0, hex: '#000000' }
      ]);
    }
  };

  // Auto-Detect and Remove Corner Background Color
  const handleAutoDetectBackground = async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = baseImageSrc;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    // Sample top-left corner
    const p1 = ctx.getImageData(2, 2, 1, 1).data;
    const r = p1[0];
    const g = p1[1];
    const b = p1[2];
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

    setRemovedColors(prev => [
      ...prev,
      { id: `corner-${Date.now()}`, r, g, b, hex }
    ]);
  };

  // Auto-Trim Transparent Margins
  const handleAutoTrimTransparentMargins = async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = previewSrc;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 15) {
          hasContent = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasContent) return;

    // Add tiny padding
    minX = Math.max(0, minX - 4);
    minY = Math.max(0, minY - 4);
    maxX = Math.min(canvas.width, maxX + 4);
    maxY = Math.min(canvas.height, maxY + 4);

    const trimW = maxX - minX;
    const trimH = maxY - minY;
    if (trimW <= 0 || trimH <= 0) return;

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimW;
    trimmedCanvas.height = trimH;
    const tCtx = trimmedCanvas.getContext('2d');
    if (!tCtx) return;

    tCtx.drawImage(canvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
    const trimmedDataUrl = trimmedCanvas.toDataURL('image/png');

    setHistory(prev => [...prev, baseImageSrc]);
    setBaseImageSrc(trimmedDataUrl);
    setPreviewSrc(trimmedDataUrl);
    setRemovedColors([]);
  };

  // Turn non-transparent pixels into pure white (white silhouette)
  const handleMakeWhiteSilhouette = async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = previewSrc;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const resultUrl = canvas.toDataURL('image/png');

    setHistory(prev => [...prev, baseImageSrc]);
    setBaseImageSrc(resultUrl);
    setPreviewSrc(resultUrl);
    setRemovedColors([]);
  };

  // Turn non-transparent pixels into pure black
  const handleMakeBlackSilhouette = async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = previewSrc;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const resultUrl = canvas.toDataURL('image/png');

    setHistory(prev => [...prev, baseImageSrc]);
    setBaseImageSrc(resultUrl);
    setPreviewSrc(resultUrl);
    setRemovedColors([]);
  };

  // Invert colors
  const handleInvertColors = async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = previewSrc;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const resultUrl = canvas.toDataURL('image/png');

    setHistory(prev => [...prev, baseImageSrc]);
    setBaseImageSrc(resultUrl);
    setPreviewSrc(resultUrl);
    setRemovedColors([]);
  };

  // Interactive Crop dragging
  const handleCropPointerDown = (handle: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDraggingCrop(true);
    setActiveCropHandle(handle);
    cropStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initBox: { ...cropBox }
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCrop || !cropStartRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const deltaX = ((e.clientX - cropStartRef.current.clientX) / rect.width) * 100;
    const deltaY = ((e.clientY - cropStartRef.current.clientY) / rect.height) * 100;
    const { initBox } = cropStartRef.current;

    let { x, y, w, h } = initBox;

    if (activeCropHandle === 'move') {
      x = Math.max(0, Math.min(100 - w, initBox.x + deltaX));
      y = Math.max(0, Math.min(100 - h, initBox.y + deltaY));
    } else if (activeCropHandle === 'tl') {
      const newX = Math.max(0, Math.min(initBox.x + initBox.w - 10, initBox.x + deltaX));
      const newY = Math.max(0, Math.min(initBox.y + initBox.h - 10, initBox.y + deltaY));
      w = initBox.w + (initBox.x - newX);
      h = initBox.h + (initBox.y - newY);
      x = newX;
      y = newY;
    } else if (activeCropHandle === 'tr') {
      const newY = Math.max(0, Math.min(initBox.y + initBox.h - 10, initBox.y + deltaY));
      w = Math.max(10, Math.min(100 - initBox.x, initBox.w + deltaX));
      h = initBox.h + (initBox.y - newY);
      y = newY;
    } else if (activeCropHandle === 'bl') {
      const newX = Math.max(0, Math.min(initBox.x + initBox.w - 10, initBox.x + deltaX));
      w = initBox.w + (initBox.x - newX);
      h = Math.max(10, Math.min(100 - initBox.y, initBox.h + deltaY));
      x = newX;
    } else if (activeCropHandle === 'br') {
      w = Math.max(10, Math.min(100 - initBox.x, initBox.w + deltaX));
      h = Math.max(10, Math.min(100 - initBox.y, initBox.h + deltaY));
    }

    setCropBox({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      w: Math.round(w * 10) / 10,
      h: Math.round(h * 10) / 10
    });
  };

  const handleCropPointerUp = () => {
    setIsDraggingCrop(false);
    setActiveCropHandle(null);
    cropStartRef.current = null;
  };

  // Apply Crop
  const handleApplyCrop = async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = previewSrc;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });

    const cropPxX = Math.floor((cropBox.x / 100) * img.naturalWidth);
    const cropPxY = Math.floor((cropBox.y / 100) * img.naturalHeight);
    const cropPxW = Math.max(1, Math.floor((cropBox.w / 100) * img.naturalWidth));
    const cropPxH = Math.max(1, Math.floor((cropBox.h / 100) * img.naturalHeight));

    const canvas = document.createElement('canvas');
    canvas.width = cropPxW;
    canvas.height = cropPxH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, cropPxX, cropPxY, cropPxW, cropPxH, 0, 0, cropPxW, cropPxH);
    const croppedDataUrl = canvas.toDataURL('image/png');

    setHistory(prev => [...prev, baseImageSrc]);
    setBaseImageSrc(croppedDataUrl);
    setPreviewSrc(croppedDataUrl);
    setRemovedColors([]);
    setCropBox({ x: 5, y: 5, w: 90, h: 90 });
    setActiveTab('knockout');
  };

  // Undo step
  const handleUndo = () => {
    if (history.length === 0) return;
    const prevSrc = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setBaseImageSrc(prevSrc);
    setPreviewSrc(prevSrc);
    setRemovedColors([]);
  };

  // Reset to original image
  const handleResetToOriginal = () => {
    setBaseImageSrc(imageSrc);
    setPreviewSrc(imageSrc);
    setHistory([]);
    setRemovedColors([]);
    setTolerance(22);
    setFeather(4);
    setCropBox({ x: 5, y: 5, w: 90, h: 90 });
  };

  // Save and apply to garment mockup
  const handleFinish = () => {
    onApply(previewSrc);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[10000] flex flex-col p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white border-0 sm:border border-slate-200 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-4xl mx-auto flex flex-col h-full sm:max-h-[92vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center shadow-xs">
              <Scissors size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg text-slate-900 font-bold tracking-wide">Logo & Graphic Studio</h3>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Editor</span>
              </div>
              <p className="text-xs text-slate-500">Remove background colors, crop borders, and clean graphics for clean fabric baking</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('knockout')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'knockout'
                ? 'border-amber-500 text-amber-700 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pipette size={14} />
            <span>Remove Colors</span>
            {removedColors.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-mono">
                {removedColors.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('crop')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'crop'
                ? 'border-amber-500 text-amber-700 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Crop size={14} />
            <span>Crop & Trim</span>
          </button>

          <button
            onClick={() => setActiveTab('adjust')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'adjust'
                ? 'border-amber-500 text-amber-700 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SunMedium size={14} />
            <span>Color Effects</span>
          </button>
        </div>

        {/* Main Work Area */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-slate-50">
          
          {/* Canvas / Image Display with Transparency Checkerboard */}
          <div className="flex-1 relative flex flex-col items-center justify-center p-4 min-h-[300px] overflow-hidden bg-slate-100/80 select-none">
            
            {/* Top helper notification */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-md border border-slate-200 px-3.5 py-1 rounded-full text-slate-700 text-xs flex items-center gap-1.5 shadow-md">
                {activeTab === 'knockout' && (
                  <>
                    <Pipette size={13} className="text-amber-600" />
                    <span>Click anywhere on the logo below to make that color transparent</span>
                  </>
                )}
                {activeTab === 'crop' && (
                  <>
                    <Crop size={13} className="text-amber-600" />
                    <span>Drag corner handles to frame the logo, then click Apply Crop</span>
                  </>
                )}
                {activeTab === 'adjust' && (
                  <>
                    <SunMedium size={13} className="text-amber-600" />
                    <span>Invert colors or generate single-color silhouettes for dark garments</span>
                  </>
                )}
              </div>
            </div>

            {/* Checkerboard Pattern Wrapper for Transparency Preview */}
            <div 
              ref={containerRef}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerLeave={handleCropPointerUp}
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #cbd5e1 25%, transparent 25%), 
                  linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #cbd5e1 75%), 
                  linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
                `,
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
              }}
              className="relative max-h-[55vh] max-w-full rounded-2xl shadow-xl border border-slate-300 overflow-hidden flex items-center justify-center bg-white"
            >
              <img
                ref={previewImgRef}
                src={previewSrc}
                alt="Logo Working Preview"
                onClick={handleImageClick}
                draggable={false}
                className={`max-h-[55vh] max-w-full object-contain block select-none ${
                  activeTab === 'knockout' ? 'cursor-crosshair' : ''
                }`}
              />

              {/* Interactive Crop Box Overlay */}
              {activeTab === 'crop' && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${cropBox.x}%`,
                    top: `${cropBox.y}%`,
                    width: `${cropBox.w}%`,
                    height: `${cropBox.h}%`
                  }}
                  className="border-2 border-dashed border-amber-500 bg-amber-500/10 cursor-move z-30"
                  onPointerDown={(e) => handleCropPointerDown('move', e)}
                >
                  {/* Top-Left handle */}
                  <div
                    onPointerDown={(e) => handleCropPointerDown('tl', e)}
                    className="absolute -top-2 -left-2 w-4 h-4 bg-amber-500 rounded-full border-2 border-white cursor-nwse-resize shadow-md"
                  />
                  {/* Top-Right handle */}
                  <div
                    onPointerDown={(e) => handleCropPointerDown('tr', e)}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-amber-500 rounded-full border-2 border-white cursor-nesw-resize shadow-md"
                  />
                  {/* Bottom-Left handle */}
                  <div
                    onPointerDown={(e) => handleCropPointerDown('bl', e)}
                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-amber-500 rounded-full border-2 border-white cursor-nesw-resize shadow-md"
                  />
                  {/* Bottom-Right handle */}
                  <div
                    onPointerDown={(e) => handleCropPointerDown('br', e)}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-amber-500 rounded-full border-2 border-white cursor-nwse-resize shadow-md"
                  />
                </div>
              )}
            </div>

            {/* Bottom Floating Info */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200 px-3.5 py-1 rounded-full shadow-md z-20 text-[11px] text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Transparent areas show as checkered pattern</span>
            </div>
          </div>

          {/* Right Control Sidebar */}
          <div className="w-full md:w-88 shrink-0 border-t md:border-t-0 md:border-l border-slate-200 p-5 flex flex-col justify-between bg-white overflow-y-auto space-y-4">
            <div className="space-y-4">
              
              {/* TAB 1: COLOR KNOCKOUT CONTROLS */}
              {activeTab === 'knockout' && (
                <div className="space-y-4">
                  {/* Quick Color Removers */}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2 block">
                      Quick Background Removal
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleQuickRemoveWhite}
                        className="p-2.5 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer bg-slate-50/60"
                      >
                        <span className="w-3.5 h-3.5 rounded border border-slate-300 bg-white" />
                        <span>Remove White</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleQuickRemoveBlack}
                        className="p-2.5 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer bg-slate-50/60"
                      >
                        <span className="w-3.5 h-3.5 rounded border border-slate-600 bg-black" />
                        <span>Remove Black</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoDetectBackground}
                      className="w-full mt-2 p-2 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer bg-slate-50/60"
                    >
                      <Sparkles size={13} className="text-amber-600" />
                      <span>Auto-Detect Corner Background</span>
                    </button>
                  </div>

                  {/* Tolerance Slider */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Color Tolerance</span>
                      <span className="text-slate-700 font-mono font-medium">{tolerance}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="75" 
                      value={tolerance} 
                      onChange={e => setTolerance(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Increase tolerance if background edges are still visible</p>
                  </div>

                  {/* Edge Softness / Feather Slider */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Edge Smoothness</span>
                      <span className="text-slate-700 font-mono font-medium">{feather}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="12" 
                      value={feather} 
                      onChange={e => setFeather(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Smooths out rough pixelated outlines for natural fabric blend</p>
                  </div>

                  {/* Removed Colors List */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Removed Colors ({removedColors.length})</span>
                      {removedColors.length > 0 && (
                        <button 
                          type="button" 
                          onClick={() => setRemovedColors([])} 
                          className="text-[10px] text-red-500 hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {removedColors.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No colors removed yet. Click anywhere on the image with the eyedropper.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {removedColors.map(c => (
                          <div 
                            key={c.id}
                            className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-xs"
                          >
                            <span 
                              className="w-3 h-3 rounded-full border border-black/20" 
                              style={{ backgroundColor: c.hex }} 
                            />
                            <span className="font-mono text-[11px] text-slate-700">{c.hex}</span>
                            <button
                              type="button"
                              onClick={() => setRemovedColors(prev => prev.filter(x => x.id !== c.id))}
                              className="text-slate-400 hover:text-red-500 ml-0.5 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CROP CONTROLS */}
              {activeTab === 'crop' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2 block">
                      Crop Tools
                    </label>
                    
                    <button
                      type="button"
                      onClick={handleApplyCrop}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Crop size={14} />
                      <span>Apply Crop Box</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAutoTrimTransparentMargins}
                      className="w-full mt-2 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 p-2.5 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer bg-slate-50/60"
                    >
                      <Scissors size={14} className="text-amber-600" />
                      <span>Auto-Trim Transparent Margins</span>
                    </button>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] space-y-1">
                    <p className="font-bold">Crop Tips:</p>
                    <p>Drag the corner dots to crop out extra margins or unwanted elements around the graphic before placing it on the shirt.</p>
                  </div>
                </div>
              )}

              {/* TAB 3: COLOR ADJUST & SILHOUETTE CONTROLS */}
              {activeTab === 'adjust' && (
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 block">
                    Graphic Color Modes
                  </label>

                  <button
                    type="button"
                    onClick={handleMakeWhiteSilhouette}
                    className="w-full border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 p-3 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-3 transition-colors cursor-pointer bg-slate-50/60"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-300 shadow-2xs flex items-center justify-center font-bold text-slate-800">
                      W
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800">Pure White Graphic</p>
                      <p className="text-[10px] text-slate-400">Best for black, navy, and dark fabrics</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleMakeBlackSilhouette}
                    className="w-full border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 p-3 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-3 transition-colors cursor-pointer bg-slate-50/60"
                  >
                    <div className="w-7 h-7 rounded-lg bg-black border border-slate-800 shadow-2xs flex items-center justify-center font-bold text-white">
                      B
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800">Pure Black Graphic</p>
                      <p className="text-[10px] text-slate-400">Best for white and light-colored fabrics</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleInvertColors}
                    className="w-full border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 p-3 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-3 transition-colors cursor-pointer bg-slate-50/60"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-black to-white border border-slate-300 shadow-2xs" />
                    <div className="text-left">
                      <p className="font-bold text-slate-800">Invert Colors (Negative)</p>
                      <p className="text-[10px] text-slate-400">Invert light tones into dark tones</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-4 border-t border-slate-200">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                  title="Undo last modification"
                >
                  <Undo size={13} />
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetToOriginal}
                  className="flex-1 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  title="Reset to initial uploaded image"
                >
                  <RotateCcw size={13} />
                  <span>Reset All</span>
                </button>
              </div>

              <Button
                onClick={handleFinish}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-full text-xs uppercase tracking-widest font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 border-0 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Apply to Garment Mockup</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
