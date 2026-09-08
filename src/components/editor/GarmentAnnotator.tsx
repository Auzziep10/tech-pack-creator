import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Trash2, MousePointer2, CheckCircle2, Maximize, Minimize, Wand2, Sparkles, X, Eraser, Crop, Layers, RotateCw, Download, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { motion, useMotionValue } from 'framer-motion';
import { eraseBrandingRegion, autoTrimWhitePadding } from '../../services/nanobananaService';
import { FreeCropper } from '../../pages/MobileScanner';
import { downloadAsLargePng } from '../../utils/imageDownloader';

// Helper function to rotate an image 90 degrees clockwise or counter-clockwise
const rotateImage90Degrees = async (imageSrc: string, direction: 'cw' | 'ccw' = 'cw'): Promise<string> => {
  const image = new Image();
  image.crossOrigin = 'Anonymous';
  image.src = imageSrc;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalHeight;
  canvas.height = image.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageSrc;

  if (direction === 'cw') {
    ctx.translate(canvas.width, 0);
    ctx.rotate((90 * Math.PI) / 180);
  } else {
    ctx.translate(0, canvas.height);
    ctx.rotate((-90 * Math.PI) / 180);
  }

  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
};

// Helper function to extract the visually cropped portion of the image into a high-res 2K JPEG
const getCroppedImg = async (imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<string> => {
  const image = new Image();
  image.crossOrigin = 'Anonymous';
  image.src = imageSrc;
  await new Promise(resolve => image.onload = resolve);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx || !pixelCrop || !pixelCrop.width || !pixelCrop.height) return imageSrc;

  let targetW = pixelCrop.width;
  let targetH = pixelCrop.height;
  const maxDim = 2048;
  if (targetW > maxDim || targetH > maxDim) {
    if (targetW > targetH) {
      targetH = Math.round((targetH * maxDim) / targetW);
      targetW = maxDim;
    } else {
      targetW = Math.round((targetW * maxDim) / targetH);
      targetH = maxDim;
    }
  }

  canvas.width = targetW;
  canvas.height = targetH;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetW,
    targetH
  );

  return canvas.toDataURL('image/jpeg', 0.92);
};

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
  isLocked?: boolean;
  onVectorize?: () => void;
  isVectorizing?: boolean;
  onGenerateMannequin?: (gender: string, garmentType: string, viewPoint: string, fitStyle: string) => Promise<string>;
  onGenerateFlatlay?: (gender: string, garmentType: string, viewPoint: string) => Promise<string>;
  onSaveMannequinImage?: (imgUrl: string) => Promise<void>;
  onSaveErasedImage?: (imgUrl: string) => Promise<void>;
  defaultGarmentType?: string;
}

export function GarmentAnnotator({ 
  imageUrl, 
  measurements, 
  isLocked = false,
  onVectorize, 
  isVectorizing,
  onGenerateMannequin,
  onGenerateFlatlay,
  onSaveMannequinImage,
  onSaveErasedImage,
  defaultGarmentType
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
  const [mannequinFitStyle, setMannequinFitStyle] = useState('Standard');

  useEffect(() => {
    if (defaultGarmentType) {
      const normalized = defaultGarmentType.toLowerCase();
      if (normalized.includes('hat') || normalized.includes('cap')) {
        setMannequinGarmentType('Hats');
        setFlatlayGarmentType('Hats');
      } else if (normalized.includes('pant') || normalized.includes('jean') || normalized.includes('trouser')) {
        setMannequinGarmentType('Pants');
        setFlatlayGarmentType('Pants');
      } else if (normalized.includes('short')) {
        setMannequinGarmentType('Shorts');
        setFlatlayGarmentType('Shorts');
      } else if (normalized.includes('hoodie')) {
        setMannequinGarmentType('Hoodie');
        setFlatlayGarmentType('Hoodie');
      } else if (normalized.includes('t-shirt') || normalized.includes('tee')) {
        setMannequinGarmentType('T-Shirt');
        setFlatlayGarmentType('T-Shirt');
      }
    }
  }, [defaultGarmentType]);
  const [isGeneratingMannequin, setIsGeneratingMannequin] = useState(false);
  const [isSavingMannequin, setIsSavingMannequin] = useState(false);
  const [mannequinResultImage, setMannequinResultImage] = useState<string | null>(null);
  const [mannequinError, setMannequinError] = useState('');

  // Flatlay States
  const [showFlatlayModal, setShowFlatlayModal] = useState(false);
  const [flatlayGender, setFlatlayGender] = useState('Unisex');
  const [flatlayGarmentType, setFlatlayGarmentType] = useState('T-Shirt');
  const [flatlayViewPoint, setFlatlayViewPoint] = useState('Front View');
  const [isGeneratingFlatlay, setIsGeneratingFlatlay] = useState(false);
  const [isSavingFlatlay, setIsSavingFlatlay] = useState(false);
  const [flatlayResultImage, setFlatlayResultImage] = useState<string | null>(null);
  const [flatlayError, setFlatlayError] = useState('');
  const [isDownloadingMockup, setIsDownloadingMockup] = useState(false);

  const [isTrimming, setIsTrimming] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  // Manual Crop States
  const [showManualCropModal, setShowManualCropModal] = useState(false);
  const [manualCropPixels, setManualCropPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isSavingManualCrop, setIsSavingManualCrop] = useState(false);

  // Branding Eraser States
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isSavingErased, setIsSavingErased] = useState(false);
  const [erasedResultImage, setErasedResultImage] = useState<string | null>(null);
  const [eraserWidth, setEraserWidth] = useState(128);
  const [eraserHeight, setEraserHeight] = useState(64);
  const eraserX = useMotionValue(0);
  const eraserY = useMotionValue(0);

  // Reset local erased image override whenever the active gallery image changes
  useEffect(() => {
    setErasedResultImage(null);
  }, [imageUrl]);

  const handleRotateImage = async (direction: 'cw' | 'ccw' = 'cw') => {
    setIsRotating(true);
    try {
      const current = erasedResultImage || imageUrl;
      const rotated = await rotateImage90Degrees(current, direction);
      setErasedResultImage(rotated);
      if (onSaveErasedImage) {
        await onSaveErasedImage(rotated);
      }
    } catch (err: any) {
      console.error("Rotate error:", err);
      alert(err?.message || "Failed to rotate image.");
    } finally {
      setIsRotating(false);
    }
  };

  const handleAutoTrimCurrent = async () => {
    setIsTrimming(true);
    try {
      const trimmed = await autoTrimWhitePadding(erasedResultImage || imageUrl);
      setErasedResultImage(trimmed);
      if (onSaveErasedImage) {
        await onSaveErasedImage(trimmed);
      }
    } catch (err) {
      console.error("Auto trim failed:", err);
    } finally {
      setIsTrimming(false);
    }
  };

  const handleGenerateMannequin = async () => {
    if (!onGenerateMannequin) return;
    setIsGeneratingMannequin(true);
    setMannequinError('');
    try {
      const generated = await onGenerateMannequin(mannequinGender, mannequinGarmentType, mannequinViewPoint, mannequinFitStyle);
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

  const handleGenerateFlatlay = async () => {
    if (!onGenerateFlatlay) return;
    setIsGeneratingFlatlay(true);
    setFlatlayError('');
    try {
      const generated = await onGenerateFlatlay(flatlayGender, flatlayGarmentType, flatlayViewPoint);
      if (generated) {
        setFlatlayResultImage(generated);
      }
    } catch (err: any) {
      console.error(err);
      setFlatlayError(err.message || 'Failed to generate flat-lay mockup. Please try again.');
    } finally {
      setIsGeneratingFlatlay(false);
    }
  };

  const handleRunEraser = async () => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      alert("Garment container not ready. Please try again.");
      return;
    }
    setIsErasing(true);
    try {
      const canvas = document.createElement('canvas');
      const garmentImg = new Image();
      garmentImg.crossOrigin = "anonymous";
      garmentImg.src = erasedResultImage || imageUrl;

      await new Promise((resolve, reject) => {
        garmentImg.onload = resolve;
        garmentImg.onerror = reject;
      });

      canvas.width = garmentImg.naturalWidth;
      canvas.height = garmentImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      // Draw white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Determine scale factor
      const scale = Math.max(canvas.width / bounds.width, canvas.height / bounds.height);

      // Eraser position in container space relative to center
      const centerX = canvas.width / 2 + eraserX.get() * scale;
      const centerY = canvas.height / 2 + eraserY.get() * scale;

      // Draw black rectangle
      const drawW = eraserWidth * scale;
      const drawH = eraserHeight * scale;

      ctx.fillStyle = '#000000';
      ctx.fillRect(centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);

      const maskBase64 = canvas.toDataURL('image/png');

      // Call nanobanana service to erase branding region
      const erased = await eraseBrandingRegion(erasedResultImage || imageUrl, maskBase64);
      
      setErasedResultImage(erased);
      setIsEraserMode(false);
      eraserX.set(0);
      eraserY.set(0);

      if (onSaveErasedImage) {
        await onSaveErasedImage(erased);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to erase branding. Please try again.');
    } finally {
      setIsErasing(false);
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

  const renderContent = () => {
    return (
      <div className={
        isFullscreen 
          ? "fixed inset-0 z-50 bg-black/60 flex flex-col p-4 md:p-8 gap-4 md:gap-6 backdrop-blur-md animate-in fade-in"
          : "flex flex-col gap-4 flex-1 min-h-0 w-full"
      }>
        {/* Artboard Toolbar */}
        {isFullscreen && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-white border border-gray-200 p-2.5 sm:p-3 rounded-xl shadow-sm shrink-0 mx-auto w-full max-w-5xl max-h-36 overflow-y-auto">
           <button 
             onClick={() => setIsBlueprintMode(!isBlueprintMode)}
             className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shrink-0 ${isBlueprintMode ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
           >
             Blueprint
           </button>
           
           <div className="w-px h-6 bg-gray-200 hidden sm:block" />
           
           <select
             value={selectedMeasurement}
             onChange={(e) => setSelectedMeasurement(e.target.value)}
             className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs sm:text-sm outline-none w-36 sm:w-48 font-medium shrink-0"
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
             onClick={() => {
               setIsDrawingMode(!isDrawingMode);
               setIsEraserMode(false);
             }}
             disabled={!selectedMeasurement}
             className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 ${
               !selectedMeasurement ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400' :
               isDrawingMode ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-gray-900 text-white hover:bg-black'
             }`}
           >
             <Pencil size={14} />
             {isDrawingMode ? 'Drawing...' : 'Add Callout'}
           </button>

            {onVectorize && (
              <div className="relative flex items-center shrink-0">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={onVectorize} 
                  isLoading={isVectorizing}
                  className="gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 shadow-sm transition-all text-xs"
                >
                  <Wand2 size={14} />
                  Vector Blueprint
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
                className="gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm transition-all text-xs shrink-0"
              >
                <Sparkles size={14} />
                Mannequin
              </Button>
            )}

            {(onGenerateFlatlay || onGenerateMannequin) && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setShowFlatlayModal(true)} 
                className="gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm transition-all text-xs shrink-0 font-bold"
                title="Create Studio Flat-Lay Mockup"
              >
                <Layers size={14} />
                Flatlay
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handleAutoTrimCurrent}
              isLoading={isTrimming}
              className="gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-sm transition-all text-xs shrink-0"
              title="Crop out excess white background to fill full height"
            >
              <Crop size={14} />
              Auto-Crop
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowManualCropModal(true)}
              className="gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200 shadow-sm transition-all text-xs shrink-0 font-bold"
              title="Manually adjust crop handles on photo"
            >
              <Crop size={14} />
              Crop Photo
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleRotateImage('cw')}
              isLoading={isRotating}
              disabled={isRotating}
              className="gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200 shadow-sm transition-all text-xs shrink-0 font-bold"
              title="Rotate image 90° clockwise"
            >
              <RotateCw size={14} />
              Rotate 90°
            </Button>

            {/* Branding Eraser / Save / Reset Controls in Toolbar */}
            {!erasedResultImage && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => {
                  setIsEraserMode(!isEraserMode);
                  setIsDrawingMode(false);
                  setSelectedMeasurement('');
                }}
                className={`gap-2 border shadow-sm mx-2 transition-all ${
                  isEraserMode 
                    ? 'bg-red-600 border-red-600 text-white hover:bg-red-700 hover:border-red-700' 
                    : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                }`}
              >
                <Eraser size={14} />
                {isEraserMode ? 'Eraser Active' : 'Branding Eraser'}
              </Button>
            )}

            {erasedResultImage && onSaveErasedImage && (
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    setIsSavingErased(true);
                    await onSaveErasedImage(erasedResultImage);
                    setErasedResultImage(null);
                  } catch (err: any) {
                    alert(err.message || 'Failed to save erased image.');
                  } finally {
                    setIsSavingErased(false);
                  }
                }}
                isLoading={isSavingErased}
                className="gap-2 bg-emerald-600 border border-emerald-600 hover:bg-emerald-700 text-white shadow-sm mx-2 transition-all font-bold"
              >
                <CheckCircle2 size={14} />
                Save Erased Image
              </Button>
            )}

            {erasedResultImage && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setErasedResultImage(null)}
                className="gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 shadow-sm mx-2 transition-all"
              >
                <X size={14} />
                Reset Image
              </Button>
            )}
           
           <button 
             onClick={() => {
               setIsFullscreen(false);
               setIsEraserMode(false);
             }}
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
          <div className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none">
            <div 
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{ touchAction: 'none' }}
              className={`relative flex items-center justify-center w-full h-full pointer-events-auto ${isDrawingMode ? 'cursor-crosshair' : ''}`}
            >
              <img 
                src={erasedResultImage || imageUrl} 
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

            {/* Draggable Eraser Bounding Box Overlay */}
            {!erasedResultImage && isEraserMode && (
              <motion.div
                drag
                dragMomentum={false}
                dragElastic={0}
                dragConstraints={containerRef}
                style={{ 
                  x: eraserX, 
                  y: eraserY,
                  width: eraserWidth,
                  height: eraserHeight,
                  marginLeft: -eraserWidth / 2,
                  marginTop: -eraserHeight / 2
                }}
                className="absolute top-1/2 left-1/2 flex items-center justify-center cursor-move z-30"
              >
                <div className="w-full h-full border-2 border-dashed border-red-500 bg-red-500/20 relative shadow-lg" />
              </motion.div>
            )}

            {/* Eraser Loading Overlay */}
            {isErasing && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center z-50">
                <div className="w-16 h-16 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h3 className="font-serif text-2xl mb-2 text-gray-900">
                  Erasing Branding
                </h3>
                <p className="text-gray-500 text-sm">
                  Analyzing the region and seamlessly blending the fabric texture...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Eraser Control Panel floating inside the canvas */}
        {!erasedResultImage && isEraserMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-red-100 space-y-3 shadow-xl z-40 pointer-events-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-red-50 pb-2">
              <div>
                <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Eraser size={14} className="text-red-600 animate-pulse" /> Branding Eraser
                </h4>
                <p className="text-[10px] text-red-700/80 mt-0.5">Drag the red box over the logo/branding you want to remove.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-red-800">
                  <span>Width</span>
                  <span>{eraserWidth}px</span>
                </div>
                <input
                  type="range"
                  min="32"
                  max="256"
                  value={eraserWidth}
                  onChange={(e) => setEraserWidth(parseInt(e.target.value))}
                  className="w-full accent-red-600 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-red-800">
                  <span>Height</span>
                  <span>{eraserHeight}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="256"
                  value={eraserHeight}
                  onChange={(e) => setEraserHeight(parseInt(e.target.value))}
                  className="w-full accent-red-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleRunEraser}
                disabled={isErasing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isErasing ? 'Erasing...' : 'Confirm Erase'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEraserMode(false);
                  eraserX.set(0);
                  eraserY.set(0);
                }}
                className="flex-1 bg-white border border-gray-200 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {!isFullscreen && !isLocked && (
          <div 
            className="absolute inset-0 z-20 hover:bg-black/5 transition-colors flex items-center justify-center gap-2.5 opacity-0 hover:opacity-100 cursor-pointer" 
            onClick={() => setIsFullscreen(true)}
          >
             <Button variant="secondary" onClick={() => setIsFullscreen(true)} className="shadow-xl gap-2 pointer-events-none">
                <Maximize size={16} />
                Edit & Annotate Image
             </Button>
             <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRotateImage('cw');
                }}
                disabled={isRotating}
                className="px-3.5 py-2 bg-black text-white font-bold rounded-xl shadow-xl hover:bg-gray-800 transition-all text-xs flex items-center gap-1.5 border border-black disabled:opacity-50"
                title="Rotate image 90° clockwise"
             >
                <RotateCw size={14} />
                Rotate 90°
             </button>
             <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowManualCropModal(true);
                }}
                className="px-3.5 py-2 bg-black text-white font-bold rounded-xl shadow-xl hover:bg-gray-800 transition-all text-xs flex items-center gap-1.5 border border-black"
                title="Crop photo to fit full size"
             >
                <Crop size={14} />
                Crop Photo
             </button>
          </div>
        )}

      {/* Manual Crop Modal */}
      {showManualCropModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex flex-col p-0 sm:p-4" onClick={() => setShowManualCropModal(false)}>
          <div className="bg-black border-0 sm:border border-white/20 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-4xl mx-auto flex flex-col h-full sm:max-h-[88vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-black/90 shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-white/50 mb-0.5">Crop Tool</p>
                <h3 className="font-serif text-xl sm:text-2xl text-white font-bold">Crop & Frame Garment</h3>
              </div>
              <button onClick={() => setShowManualCropModal(false)} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 relative bg-black min-h-0 w-full overflow-hidden">
              <FreeCropper
                imageSrc={erasedResultImage || imageUrl}
                onCropComplete={(pixels) => setManualCropPixels(pixels)}
              />
            </div>

            <div className="p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-black/90 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowManualCropModal(false)}
                className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={async () => {
                  if (!manualCropPixels) return;
                  setIsSavingManualCrop(true);
                  try {
                    const cropped = await getCroppedImg(erasedResultImage || imageUrl, manualCropPixels);
                    setErasedResultImage(cropped);
                    if (onSaveErasedImage) {
                      await onSaveErasedImage(cropped);
                    }
                    setShowManualCropModal(false);
                  } catch (err: any) {
                    alert(err?.message || "Failed to crop image.");
                  } finally {
                    setIsSavingManualCrop(false);
                  }
                }}
                isLoading={isSavingManualCrop}
                className="bg-white text-black hover:bg-gray-200 px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors shadow-lg"
              >
                Apply & Save Crop
              </Button>
            </div>
          </div>
        </div>
      )}

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
                  <div className="aspect-[3/4] bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center relative group">
                    <img src={mannequinResultImage || imageUrl} className="w-full h-full object-contain p-2" />
                    {mannequinResultImage && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (isDownloadingMockup) return;
                          try {
                            setIsDownloadingMockup(true);
                            await downloadAsLargePng(mannequinResultImage, 'ghost_mannequin_render', { resolution: 'large' });
                          } catch (err) {
                            console.error('Download failed:', err);
                            alert('Download failed. Please try again.');
                          } finally {
                            setIsDownloadingMockup(false);
                          }
                        }}
                        disabled={isDownloadingMockup}
                        className="absolute top-3 right-3 py-1.5 px-3 bg-white/95 hover:bg-black hover:text-white rounded-full shadow-md text-gray-700 transition-all border border-gray-200 z-10 flex items-center gap-1.5 text-xs font-bold"
                        title="Download Large Full-Size PNG (2.5K Studio Quality)"
                      >
                        {isDownloadingMockup ? <Loader2 size={13} className="animate-spin text-black" /> : <Download size={13} />}
                        <span>PNG</span>
                      </button>
                    )}
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
                        onChange={e => {
                          const newType = e.target.value;
                          setMannequinGarmentType(newType);
                          if (newType === 'Hats') {
                            setMannequinFitStyle('Standard');
                          } else if (['Structured', 'High Crown', 'Mid Profile', 'Low Profile'].includes(mannequinFitStyle)) {
                            setMannequinFitStyle('Standard');
                          }
                        }}
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

                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block">
                        {mannequinGarmentType === 'Hats' ? 'Crown Profile / Fit' : 'Fit / Silhouette'}
                      </label>
                      <select
                        value={mannequinFitStyle}
                        onChange={e => setMannequinFitStyle(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-black transition-all appearance-none cursor-pointer"
                      >
                        {mannequinGarmentType === 'Hats' ? (
                          <>
                            <option value="Standard">Standard 3D Profile</option>
                            <option value="Structured">Structured (Firm Front Panels)</option>
                            <option value="High Crown">High Crown (Tall / Flat Brim)</option>
                            <option value="Mid Profile">Mid Profile (Snapback / Trucker)</option>
                            <option value="Low Profile">Low Profile / Dad Hat (Unstructured)</option>
                          </>
                        ) : (
                          <>
                            <option value="Fitted">Fitted</option>
                            <option value="Standard">Standard</option>
                            <option value="Loose">Loose</option>
                            <option value="Boxy">Boxy</option>
                            <option value="Athleisure">Athleisure</option>
                          </>
                        )}
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

      {showFlatlayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowFlatlayModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Mockup Generator</p>
                <h3 className="font-serif text-2xl text-gray-900">Create Studio Flat-Lay</h3>
              </div>
              <button onClick={() => setShowFlatlayModal(false)} className="p-2 hover:bg-gray-50 rounded-full text-gray-500 hover:text-black transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="aspect-[3/4] bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center relative group">
                    <img src={flatlayResultImage || imageUrl} className="w-full h-full object-contain p-2" />
                    {flatlayResultImage && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (isDownloadingMockup) return;
                          try {
                            setIsDownloadingMockup(true);
                            await downloadAsLargePng(flatlayResultImage, 'tabletop_flatlay_render', { resolution: 'large' });
                          } catch (err) {
                            console.error('Download failed:', err);
                            alert('Download failed. Please try again.');
                          } finally {
                            setIsDownloadingMockup(false);
                          }
                        }}
                        disabled={isDownloadingMockup}
                        className="absolute top-3 right-3 py-1.5 px-3 bg-white/95 hover:bg-black hover:text-white rounded-full shadow-md text-gray-700 transition-all border border-gray-200 z-10 flex items-center gap-1.5 text-xs font-bold"
                        title="Download Large Full-Size PNG (2.5K Studio Quality)"
                      >
                        {isDownloadingMockup ? <Loader2 size={13} className="animate-spin text-black" /> : <Download size={13} />}
                        <span>PNG</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block">Gender</label>
                      <select
                        value={flatlayGender}
                        onChange={e => setFlatlayGender(e.target.value)}
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
                        value={flatlayGarmentType}
                        onChange={e => setFlatlayGarmentType(e.target.value)}
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
                        value={flatlayViewPoint}
                        onChange={e => setFlatlayViewPoint(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-black transition-all appearance-none cursor-pointer"
                      >
                        <option value="Front View">Front View</option>
                        <option value="Back View">Back View</option>
                      </select>
                    </div>
                  </div>

                  {flatlayError && (
                    <p className="text-red-500 text-xs font-medium">{flatlayError}</p>
                  )}

                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <Button
                      onClick={handleGenerateFlatlay}
                      disabled={isGeneratingFlatlay}
                      isLoading={isGeneratingFlatlay}
                      className="w-full bg-indigo-600 text-white py-3 rounded-full text-xs uppercase tracking-widest font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Layers size={14} /> {isGeneratingFlatlay ? 'Generating Flat-Lay...' : (flatlayResultImage ? 'Regenerate Flat-Lay' : 'Create Tabletop Flat-Lay')}
                    </Button>

                    {flatlayResultImage && onSaveMannequinImage && (
                      <Button
                        onClick={async () => {
                          try {
                            setIsSavingFlatlay(true);
                            await onSaveMannequinImage(flatlayResultImage);
                            setShowFlatlayModal(false);
                            setFlatlayResultImage(null);
                          } catch (err: any) {
                            setFlatlayError(err.message || 'Failed to save image.');
                          } finally {
                            setIsSavingFlatlay(false);
                          }
                        }}
                        disabled={isSavingFlatlay}
                        isLoading={isSavingFlatlay}
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
  };

  if (isFullscreen) {
    return createPortal(renderContent(), document.body);
  }

  return renderContent();
}
