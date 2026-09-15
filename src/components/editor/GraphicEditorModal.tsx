import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Scissors, Check } from 'lucide-react';

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

function getContrastYIQ(hexcolor: string): 'black' | 'white' {
  const hex = hexcolor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? 'black' : 'white';
}

function extractDominantColors(img: HTMLImageElement, count = 5): string[] {
  const canvas = document.createElement('canvas');
  const w = Math.min(img.naturalWidth, 120);
  const h = Math.min(img.naturalHeight, 120);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const colorBuckets: Record<string, { r: number; g: number; b: number; count: number }> = {};
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 60) continue; // skip transparent
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const qr = Math.round(r / 24) * 24;
    const qg = Math.round(g / 24) * 24;
    const qb = Math.round(b / 24) * 24;
    const key = `${qr},${qg},${qb}`;
    if (!colorBuckets[key]) {
      colorBuckets[key] = { r: qr, g: qg, b: qb, count: 1 };
    } else {
      colorBuckets[key].count++;
    }
  }

  const sorted = Object.values(colorBuckets).sort((a, b) => b.count - a.count);
  const dominant: string[] = [];

  for (const item of sorted) {
    if (dominant.length >= count) break;
    const hex = `#${((1 << 24) + (Math.min(255, item.r) << 16) + (Math.min(255, item.g) << 8) + Math.min(255, item.b)).toString(16).slice(1).toUpperCase()}`;
    const isTooClose = dominant.some(existingHex => {
      const er = parseInt(existingHex.slice(1, 3), 16);
      const eg = parseInt(existingHex.slice(3, 5), 16);
      const eb = parseInt(existingHex.slice(5, 7), 16);
      const dist = Math.sqrt((item.r - er) ** 2 + (item.g - eg) ** 2 + (item.b - eb) ** 2);
      return dist < 32;
    });
    if (!isTooClose) {
      dominant.push(hex);
    }
  }

  return dominant;
}

export function GraphicEditorModal({ isOpen, onClose, imageSrc, onApply }: GraphicEditorModalProps) {
  const [baseImageSrc, setBaseImageSrc] = useState<string>(imageSrc);
  const [previewSrc, setPreviewSrc] = useState<string>(imageSrc);
  const [removedColors, setRemovedColors] = useState<RemovedColor[]>([]);
  const [tolerance, setTolerance] = useState<number>(30); // Default 30% to match InkTheory
  const [dominantColors, setDominantColors] = useState<string[]>([]);
  const [hoverColor, setHoverColor] = useState<{ r: number; g: number; b: number; hex: string; clientX: number; clientY: number } | null>(null);

  const previewImgRef = useRef<HTMLImageElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize and extract dominant palette when image opens
  useEffect(() => {
    if (isOpen && imageSrc) {
      setBaseImageSrc(imageSrc);
      setPreviewSrc(imageSrc);
      setRemovedColors([]);
      setTolerance(30);
      setHoverColor(null);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const dominant = extractDominantColors(img, 5);
        setDominantColors(dominant);
      };
      img.src = imageSrc;
    }
  }, [isOpen, imageSrc]);

  // Apply color knockout to compute live preview
  const applyColorKnockout = useCallback(async (baseSrc: string, colors: RemovedColor[], tol: number) => {
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
    const fthr = 4;

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
    applyColorKnockout(baseImageSrc, removedColors, tolerance);
  }, [baseImageSrc, removedColors, tolerance, applyColorKnockout]);

  // Click directly on the image to sample and remove color
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = previewImgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const imgRatio = img.naturalWidth / (img.naturalHeight || 1);
    const elemRatio = rect.width / (rect.height || 1);
    let actualW = rect.width;
    let actualH = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elemRatio > imgRatio) {
      actualW = rect.height * imgRatio;
      offsetX = (rect.width - actualW) / 2;
    } else {
      actualH = rect.width / imgRatio;
      offsetY = (rect.height - actualH) / 2;
    }

    const adjustedX = clickX - offsetX;
    const adjustedY = clickY - offsetY;

    if (adjustedX < 0 || adjustedX > actualW || adjustedY < 0 || adjustedY > actualH) {
      return;
    }

    const pxX = Math.floor((adjustedX / actualW) * img.naturalWidth);
    const pxY = Math.floor((adjustedY / actualH) * img.naturalHeight);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const sampleImg = new Image();
    sampleImg.crossOrigin = 'anonymous';
    sampleImg.onload = () => {
      ctx.drawImage(sampleImg, 0, 0);
      const pixel = ctx.getImageData(
        Math.max(0, Math.min(img.naturalWidth - 1, pxX)),
        Math.max(0, Math.min(img.naturalHeight - 1, pxY)),
        1,
        1
      ).data;

      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

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
    sampleImg.src = baseImageSrc;
  };

  // Hover color inspector over image
  const handleImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = previewImgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const imgRatio = img.naturalWidth / (img.naturalHeight || 1);
    const elemRatio = rect.width / (rect.height || 1);
    let actualW = rect.width;
    let actualH = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elemRatio > imgRatio) {
      actualW = rect.height * imgRatio;
      offsetX = (rect.width - actualW) / 2;
    } else {
      actualH = rect.width / imgRatio;
      offsetY = (rect.height - actualH) / 2;
    }

    const adjustedX = clickX - offsetX;
    const adjustedY = clickY - offsetY;

    if (adjustedX < 0 || adjustedX > actualW || adjustedY < 0 || adjustedY > actualH) {
      if (hoverColor) setHoverColor(null);
      return;
    }

    const pxX = Math.floor((adjustedX / actualW) * img.naturalWidth);
    const pxY = Math.floor((adjustedY / actualH) * img.naturalHeight);

    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement('canvas');
    }
    const canvas = sampleCanvasRef.current;
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) ctx.drawImage(img, 0, 0);
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const pixel = ctx.getImageData(
        Math.max(0, Math.min(img.naturalWidth - 1, pxX)),
        Math.max(0, Math.min(img.naturalHeight - 1, pxY)),
        1,
        1
      ).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const a = pixel[3];
      if (a === 0) {
        if (hoverColor) setHoverColor(null);
        return;
      }
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
      setHoverColor({ r, g, b, hex, clientX: e.clientX, clientY: e.clientY });
    }
  };

  const handleImageMouseLeave = () => {
    setHoverColor(null);
  };

  // Toggle dominant color preset
  const toggleDominantColor = (hex: string) => {
    const existing = removedColors.find(c => c.hex.toLowerCase() === hex.toLowerCase());
    if (existing) {
      setRemovedColors(prev => prev.filter(c => c.id !== existing.id));
    } else {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      setRemovedColors(prev => [
        ...prev,
        { id: `dom-${hex}-${Date.now()}`, r, g, b, hex }
      ]);
    }
  };

  // Auto-Crop Tight
  const handleAutoCropTight = async () => {
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
    let hasPixels = false;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        if (data[idx + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasPixels = true;
        }
      }
    }

    if (!hasPixels) return;

    const pad = 2;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(canvas.width - cropX, (maxX - minX + 1) + pad * 2);
    const cropH = Math.min(canvas.height - cropY, (maxY - minY + 1) + pad * 2);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cCtx = cropCanvas.getContext('2d');
    if (!cCtx) return;

    cCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const croppedUrl = cropCanvas.toDataURL('image/png');

    setBaseImageSrc(croppedUrl);
    setPreviewSrc(croppedUrl);
    setRemovedColors([]);
  };

  // Clear all removed colors
  const handleClearAll = () => {
    setRemovedColors([]);
    setBaseImageSrc(imageSrc);
    setPreviewSrc(imageSrc);
  };

  // Finish and save
  const handleFinish = () => {
    onApply(previewSrc);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[10000] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full h-full max-w-6xl max-h-[94vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white shrink-0">
          <div>
            <h2 className="font-serif text-2xl font-normal text-slate-900 tracking-tight">Manual Background & Color Remover</h2>
            <p className="text-xs text-slate-500 mt-1">Click on specific pixels or choose dominant presets below to make colors transparent.</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Main Work Area: Split Canvas (Left) and Controls (Right) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0 overflow-hidden bg-slate-50/50">
          
          {/* Left Canvas with Checkerboard Pattern */}
          <div className="flex-1 min-w-0 min-h-[350px] md:min-h-0 p-4 sm:p-8 flex items-center justify-center overflow-hidden relative select-none">
            <div 
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #e2e8f0 25%, transparent 25%), 
                  linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #e2e8f0 75%), 
                  linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
                `,
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
              }}
              className="w-full h-full max-h-[66vh] max-w-full rounded-2xl shadow-inner border border-slate-200 overflow-hidden flex items-center justify-center bg-white p-4"
            >
              <img
                ref={previewImgRef}
                src={previewSrc}
                alt="Working Graphic"
                onClick={handleImageClick}
                onMouseMove={handleImageMouseMove}
                onMouseLeave={handleImageMouseLeave}
                draggable={false}
                className="max-h-full max-w-full object-contain block select-none cursor-crosshair drop-shadow-xs"
              />
            </div>
          </div>

          {/* Right Controls Panel */}
          <div className="w-full md:w-[340px] lg:w-[380px] shrink-0 border-t md:border-t-0 md:border-l border-slate-100 p-6 flex flex-col justify-between bg-white overflow-y-auto space-y-6">
            <div className="space-y-6">
              
              {/* 1. ACTIVE REMOVAL LIST */}
              <div>
                <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block mb-2">
                  Active Removal List
                </label>
                {removedColors.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No colors removed yet. Click anywhere on the graphic.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                    {removedColors.map(c => (
                      <div 
                        key={c.id} 
                        className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-xs font-mono shadow-2xs transition-colors"
                      >
                        <span 
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" 
                          style={{ backgroundColor: c.hex }} 
                        />
                        <span className="text-slate-800 font-semibold">{c.hex}</span>
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

              {/* 2. DOMINANT PALETTE */}
              <div>
                <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block mb-2">
                  Dominant Palette
                </label>
                <div className="flex items-center gap-2.5">
                  {dominantColors.map((hex, idx) => {
                    const isRemoved = removedColors.some(c => c.hex.toLowerCase() === hex.toLowerCase());
                    const contrast = getContrastYIQ(hex);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDominantColor(hex)}
                        className={`w-9 h-9 rounded-full border transition-all cursor-pointer relative shadow-2xs ${
                          isRemoved ? 'ring-2 ring-slate-900 border-white scale-105' : 'border-slate-300 hover:scale-105'
                        }`}
                        style={{ backgroundColor: hex }}
                        title={`Click to ${isRemoved ? 'restore' : 'remove'} ${hex}`}
                      >
                        {isRemoved && (
                          <Check size={14} className={`absolute inset-0 m-auto ${contrast === 'white' ? 'text-white' : 'text-slate-900'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. CROP */}
              <div>
                <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block mb-2">
                  Crop
                </label>
                <button
                  type="button"
                  onClick={handleAutoCropTight}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-slate-900 text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Scissors size={14} />
                  <span>Auto-Crop Tight</span>
                </button>

                {/* Callout box */}
                <div className="mt-3 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                  <p>
                    <strong className="font-bold">For the most accurate print:</strong> crop your logo as tight as possible. Empty space around the artwork counts as part of your print size — a tight crop means true-to-size placement and pricing.
                  </p>
                </div>
              </div>

              {/* 4. COLOR FUZZINESS TOLERANCE */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-2">
                  <span>Color Fuzziness Tolerance</span>
                  <span className="font-mono">{tolerance}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="75"
                  value={tolerance}
                  onChange={e => setTolerance(Number(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
          <button
            type="button"
            onClick={handleClearAll}
            className="border border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-semibold text-xs px-5 py-2.5 rounded-full hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            Clear All
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-semibold text-xs px-5 py-2.5 rounded-full hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinish}
              className="bg-slate-950 hover:bg-black text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              Apply & Save Transparency
            </button>
          </div>
        </div>
      </div>

      {/* Live Hover Eyedropper Loupe */}
      {hoverColor && (
        <div 
          style={{
            position: 'fixed',
            left: `${hoverColor.clientX + 16}px`,
            top: `${hoverColor.clientY + 16}px`,
            pointerEvents: 'none'
          }}
          className="z-[10001] flex items-center gap-2 bg-slate-900/95 text-white backdrop-blur-md px-2.5 py-1.5 rounded-lg shadow-xl text-xs font-mono border border-slate-700 animate-in fade-in duration-75 select-none"
        >
          <div 
            className="w-4 h-4 rounded border border-white/60 shadow-inner shrink-0" 
            style={{ backgroundColor: hoverColor.hex }} 
          />
          <span className="font-bold">{hoverColor.hex}</span>
          <span className="text-[10px] text-amber-300 font-sans uppercase font-bold tracking-wider">Click to remove</span>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
