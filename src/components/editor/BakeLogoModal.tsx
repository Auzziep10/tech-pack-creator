import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, UploadCloud, RotateCw, CheckCircle2, Download, Loader2, ArrowLeftRight, Trash2, Sliders, Layers } from 'lucide-react';
import { Button } from '../ui/Button';
import { bakeGarmentLogo } from '../../services/nanobananaService';
import { downloadAsLargePng } from '../../utils/imageDownloader';

interface BakeLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSaveImage: (newImageUrl: string) => Promise<void>;
}

type PrintStyle = 'Screenprint' | 'Embroidered' | 'Vintage Distressed' | 'Direct-to-Garment';

export function BakeLogoModal({ isOpen, onClose, imageUrl, onSaveImage }: BakeLogoModalProps) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string>('');
  
  // Placement & Transform States (relative to garment center in percentage)
  const [posX, setPosX] = useState(0); // -45 to 45%
  const [posY, setPosY] = useState(-10); // -45 to 45%
  const [scale, setScale] = useState(35); // 10% to 100% of garment width
  const [rotation, setRotation] = useState(0); // -180 to 180 degrees
  const [styleOption, setStyleOption] = useState<PrintStyle>('Screenprint');

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initX: number; initY: number } | null>(null);

  const [isBaking, setIsBaking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'baked' | 'original'>('baked');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const garmentImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setLogoSrc(null);
      setLogoName('');
      setResultImage(null);
      setError(null);
      setPosX(0);
      setPosY(-10);
      setScale(35);
      setRotation(0);
    }
  }, [isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, SVG, or JPG).');
      return;
    }

    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoSrc(event.target?.result as string);
      setResultImage(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Pointer dragging on artboard for intuitive logo positioning
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!logoSrc || resultImage) return;
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initX: posX,
      initY: posY
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const deltaX = ((e.clientX - dragStartRef.current.clientX) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStartRef.current.clientY) / rect.height) * 100;

    const newX = Math.max(-45, Math.min(45, dragStartRef.current.initX + deltaX));
    const newY = Math.max(-45, Math.min(45, dragStartRef.current.initY + deltaY));

    setPosX(Math.round(newX * 10) / 10);
    setPosY(Math.round(newY * 10) / 10);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
  };

  // Render high-resolution composite of garment + placed logo
  const createCompositeImage = async (): Promise<string> => {
    if (!logoSrc) throw new Error('No logo uploaded');

    const garment = new Image();
    garment.crossOrigin = 'anonymous';
    garment.src = imageUrl;
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
    if (!ctx) throw new Error('Could not create composite canvas context');

    // Draw solid pure white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw garment image
    ctx.drawImage(garment, 0, 0, canvas.width, canvas.height);

    // Calculate logo dimensions on full natural resolution
    const logoTargetWidth = (canvas.width * scale) / 100;
    const logoAspect = logo.naturalHeight / (logo.naturalWidth || 1);
    const logoTargetHeight = logoTargetWidth * logoAspect;

    const centerPxX = canvas.width / 2 + (canvas.width * posX) / 100;
    const centerPxY = canvas.height / 2 + (canvas.height * posY) / 100;

    // Draw rotated and scaled logo
    ctx.save();
    ctx.translate(centerPxX, centerPxY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(
      logo,
      -logoTargetWidth / 2,
      -logoTargetHeight / 2,
      logoTargetWidth,
      logoTargetHeight
    );
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const handleBake = async () => {
    if (!logoSrc) {
      setError('Please upload a logo first.');
      return;
    }

    setIsBaking(true);
    setError(null);

    try {
      const compositeBase64 = await createCompositeImage();
      const baked = await bakeGarmentLogo(compositeBase64, styleOption);
      setResultImage(baked);
      setPreviewMode('baked');
    } catch (err: any) {
      console.error('Bake Logo Error:', err);
      setError(err?.message || 'Failed to bake logo into garment. Please try again.');
    } finally {
      setIsBaking(false);
    }
  };

  const handleSave = async () => {
    if (!resultImage) return;
    setIsSaving(true);
    try {
      await onSaveImage(resultImage);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save baked garment.');
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg sm:text-xl text-white font-bold tracking-wide">Logo Studio & Realistic Fabric Baking</h3>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">Studio</span>
              </div>
              <p className="text-xs text-white/50">Position brand graphics and bake them realistically into garment cloth folds, creases & weave</p>
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
          {/* Canvas Interactive Area */}
          <div className="flex-1 relative flex flex-col items-center justify-center p-4 min-h-[350px] overflow-hidden bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px]">
            <div 
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{ touchAction: 'none' }}
              className={`relative max-w-full max-h-full flex items-center justify-center select-none shadow-2xl rounded-2xl overflow-hidden bg-white ${
                logoSrc && !resultImage ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              <img 
                ref={garmentImgRef}
                src={previewMode === 'baked' && resultImage ? resultImage : imageUrl} 
                alt="Garment Display"
                draggable={false}
                className="max-h-[60vh] max-w-full object-contain pointer-events-none"
              />

              {/* Placed Logo Overlay (when in placement mode) */}
              {logoSrc && !resultImage && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${50 + posX}%`,
                    top: `${50 + posY}%`,
                    width: `${scale}%`,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    pointerEvents: 'none'
                  }}
                  className="z-20 transition-transform duration-75"
                >
                  <div className="relative group/logo">
                    <img 
                      src={logoSrc} 
                      alt="Logo Overlay" 
                      draggable={false}
                      className="w-full h-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] select-none" 
                    />
                    <div className="absolute inset-0 border-2 border-dashed border-amber-500/80 rounded pointer-events-none opacity-80" />
                  </div>
                </div>
              )}

              {/* Baking Loading Overlay */}
              {isBaking && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                    <Sparkles className="w-6 h-6 text-amber-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">Baking Logo Realistically...</h4>
                  <p className="text-white/60 text-xs max-w-xs">
                    Adapting graphic to natural fabric folds, cloth ripples, surface texture, and ambient lighting
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Artboard Overlay Actions */}
            {resultImage && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-2xl z-20">
                <button
                  onClick={() => setPreviewMode(m => m === 'baked' ? 'original' : 'baked')}
                  className="flex items-center gap-1.5 text-xs text-white/90 hover:text-white font-medium px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                >
                  <ArrowLeftRight size={14} />
                  <span>{previewMode === 'baked' ? 'Show Flat Overlay' : 'Show Baked Result'}</span>
                </button>
                <div className="h-4 w-px bg-white/20" />
                <button
                  onClick={async () => {
                    if (isDownloading) return;
                    setIsDownloading(true);
                    try {
                      await downloadAsLargePng(resultImage, 'baked_logo_garment', { resolution: 'large' });
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
          <div className="w-full md:w-96 shrink-0 border-t md:border-t-0 md:border-l border-white/10 p-5 flex flex-col justify-between bg-neutral-900 overflow-y-auto space-y-4">
            <div className="space-y-4">
              {/* Logo File Selector */}
              <div>
                <label className="text-xs uppercase tracking-widest font-bold text-white/60 mb-2 block">
                  Brand Logo / Graphic
                </label>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/png,image/svg+xml,image/jpeg,image/webp" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />

                {!logoSrc ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-white/15 hover:border-amber-500/50 hover:bg-amber-500/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/70 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-all">
                      <UploadCloud size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Upload Logo or Graphic</p>
                      <p className="text-[11px] text-white/40 mt-0.5">PNG, SVG, or JPG (transparent PNG recommended)</p>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-neutral-950 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-white/5 p-1 border border-white/10 shrink-0 flex items-center justify-center">
                        <img src={logoSrc} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{logoName || 'Custom Graphic'}</p>
                        <p className="text-[10px] text-emerald-400 font-semibold">Ready to place</p>
                      </div>
                    </div>
                    {!resultImage && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLogoSrc(null);
                            setLogoName('');
                          }}
                          className="p-1 text-white/40 hover:text-red-400 rounded hover:bg-white/5 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Positioning & Finish Controls (only shown before baking or when re-adjusting) */}
              {logoSrc && !resultImage && (
                <div className="space-y-4 pt-2 border-t border-white/5 animate-in fade-in">
                  {/* Drag Hint */}
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-300 text-[11px]">
                    <Sliders size={14} className="shrink-0" />
                    <span>Click & drag the logo on the garment to position it, or use the sliders below.</span>
                  </div>

                  {/* Scale Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60 uppercase font-bold tracking-wider text-[10px]">Scale / Size</span>
                      <span className="text-white font-mono">{scale}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="90" 
                      value={scale} 
                      onChange={e => setScale(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Rotation Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/60 uppercase font-bold tracking-wider text-[10px]">Rotation</span>
                      <div className="flex items-center gap-1">
                        <span className="text-white font-mono">{rotation}°</span>
                        {rotation !== 0 && (
                          <button 
                            type="button" 
                            onClick={() => setRotation(0)} 
                            className="text-[10px] text-amber-400 hover:underline ml-1"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="-180" 
                      max="180" 
                      value={rotation} 
                      onChange={e => setRotation(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Finish / Print Style Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-widest font-bold text-white/60 block">
                      Fabric Finish Style
                    </label>
                    <select
                      value={styleOption}
                      onChange={e => setStyleOption(e.target.value as PrintStyle)}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Screenprint">Screenprint (Clean matte ink, cloth fold blend)</option>
                      <option value="Embroidered">Embroidered (3D thread stitches & sheen)</option>
                      <option value="Vintage Distressed">Vintage Distressed (Patina, weathered wear)</option>
                      <option value="Direct-to-Garment">Direct-to-Garment (Ultra soft-hand DTG)</option>
                    </select>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                  {error}
                </div>
              )}

              {resultImage && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-amber-400" />
                  <span>Logo baked realistically into the garment fabric! Review the result and save to your tech pack.</span>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-4 border-t border-white/10">
              {!resultImage ? (
                <Button
                  onClick={handleBake}
                  disabled={isBaking || !logoSrc}
                  isLoading={isBaking}
                  className="w-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white py-3 rounded-full text-xs uppercase tracking-widest font-bold shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 border-0 disabled:opacity-50"
                >
                  <Sparkles size={15} />
                  {isBaking ? 'Baking into Fabric...' : 'Bake Logo into Garment'}
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
                      onClick={() => setResultImage(null)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      Adjust Placement
                    </button>
                    <button
                      type="button"
                      onClick={handleBake}
                      disabled={isBaking}
                      className="flex-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
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
