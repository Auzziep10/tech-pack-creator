import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { completeScanSession, updateScanSessionFront, uploadGarmentImage } from '../services/dbService';
import { Camera, CheckCircle2, RefreshCw } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';

// Helper function to extract the visually cropped portion of the image into a neat JPEG
const getCroppedImg = async (imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<string> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise(resolve => image.onload = resolve);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx || !pixelCrop || !pixelCrop.width || !pixelCrop.height) return imageSrc;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg', 0.95);
};

interface FreeCropperProps {
  imageSrc: string;
  onCropComplete: (pixelCrop: { x: number; y: number; width: number; height: number }) => void;
}

export function FreeCropper({ imageSrc, onCropComplete }: FreeCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Aspect ratio state: default to '4:5' vertical for perfect Tech Pack card fitting!
  const [aspectMode, setAspectMode] = useState<'free' | '4:5' | '1:1' | '3:4' | 'full'>('4:5');

  // Crop box percentage values relative to displayed image: 0 to 100
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 5,
    y: 5,
    w: 90,
    h: 90,
  });

  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const startTouchRef = useRef<{ touchX: number; touchY: number; initialBox: { x: number; y: number; w: number; h: number } } | null>(null);
  const naturalSizeRef = useRef<{ width: number; height: number }>({ width: 1, height: 1 });

  const emitPixelCrop = useCallback((box: { x: number; y: number; w: number; h: number }) => {
    const { width: nw, height: nh } = naturalSizeRef.current;
    const pixelCrop = {
      x: Math.max(0, Math.round((box.x / 100) * nw)),
      y: Math.max(0, Math.round((box.y / 100) * nh)),
      width: Math.min(nw, Math.round((box.w / 100) * nw)),
      height: Math.min(nh, Math.round((box.h / 100) * nh)),
    };
    onCropComplete(pixelCrop);
  }, [onCropComplete]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    naturalSizeRef.current = { width: img.naturalWidth, height: img.naturalHeight };
    
    // Automatically apply 4:5 vertical ratio crop box on load to fit card perfectly
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const targetRatio = 4 / 5;
    let newBox = { x: 5, y: 5, w: 90, h: 90 };

    const imgRatio = (nw * 0.9) / (nh * 0.9);
    if (imgRatio > targetRatio) {
      const targetW = ((nh * 0.9 * targetRatio) / nw) * 100;
      newBox.x = Math.max(0, (100 - targetW) / 2);
      newBox.w = targetW;
      newBox.y = 5;
      newBox.h = 90;
    } else {
      const targetH = (((nw * 0.9) / targetRatio) / nh) * 100;
      newBox.y = Math.max(0, (100 - targetH) / 2);
      newBox.h = targetH;
      newBox.x = 5;
      newBox.w = 90;
    }

    setCropBox(newBox);
    emitPixelCrop(newBox);
  };

  // Adjust crop box when aspect ratio preset button is clicked
  const handleAspectChange = (mode: 'free' | '4:5' | '1:1' | '3:4' | 'full') => {
    setAspectMode(mode);
    let newBox = { ...cropBox };

    if (mode === 'full') {
      newBox = { x: 2, y: 2, w: 96, h: 96 };
    } else if (mode !== 'free') {
      const ratioMap: Record<string, number> = {
        '4:5': 4 / 5,
        '1:1': 1 / 1,
        '3:4': 3 / 4,
      };
      const targetRatio = ratioMap[mode];
      const { width: nw, height: nh } = naturalSizeRef.current;
      const imgRatio = (nw * (newBox.w / 100)) / (nh * (newBox.h / 100));

      if (imgRatio > targetRatio) {
        const targetW = ((nh * (newBox.h / 100) * targetRatio) / nw) * 100;
        newBox.x = Math.max(0, newBox.x + (newBox.w - targetW) / 2);
        newBox.w = targetW;
      } else {
        const targetH = (((nw * (newBox.w / 100)) / targetRatio) / nh) * 100;
        newBox.y = Math.max(0, newBox.y + (newBox.h - targetH) / 2);
        newBox.h = targetH;
      }
    }

    setCropBox(newBox);
    emitPixelCrop(newBox);
  };

  const handlePointerStart = (handle: string, clientX: number, clientY: number) => {
    setActiveHandle(handle);
    startTouchRef.current = {
      touchX: clientX,
      touchY: clientY,
      initialBox: { ...cropBox },
    };
  };

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!activeHandle || !startTouchRef.current || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaXPercent = ((clientX - startTouchRef.current.touchX) / rect.width) * 100;
    const deltaYPercent = ((clientY - startTouchRef.current.touchY) / rect.height) * 100;

    const { initialBox } = startTouchRef.current;
    let { x, y, w, h } = initialBox;

    const minSize = 8; // minimum 8% width/height

    if (activeHandle === 'move') {
      x = Math.max(0, Math.min(100 - w, initialBox.x + deltaXPercent));
      y = Math.max(0, Math.min(100 - h, initialBox.y + deltaYPercent));
    } else {
      if (activeHandle.includes('w')) {
        const newX = Math.max(0, Math.min(initialBox.x + initialBox.w - minSize, initialBox.x + deltaXPercent));
        w = initialBox.x + initialBox.w - newX;
        x = newX;
      }
      if (activeHandle.includes('e')) {
        w = Math.max(minSize, Math.min(100 - initialBox.x, initialBox.w + deltaXPercent));
      }
      if (activeHandle.includes('n')) {
        const newY = Math.max(0, Math.min(initialBox.y + initialBox.h - minSize, initialBox.y + deltaYPercent));
        h = initialBox.y + initialBox.h - newY;
        y = newY;
      }
      if (activeHandle.includes('s')) {
        h = Math.max(minSize, Math.min(100 - initialBox.y, initialBox.h + deltaYPercent));
      }
    }

    const updatedBox = { x, y, w, h };
    setCropBox(updatedBox);
    emitPixelCrop(updatedBox);
  }, [activeHandle, emitPixelCrop]);

  const handlePointerEnd = useCallback(() => {
    setActiveHandle(null);
    startTouchRef.current = null;
  }, []);

  return (
    <div className="flex flex-col h-full w-full select-none bg-black">
      {/* Aspect Ratio Selector Pills */}
      <div className="bg-black/90 px-4 py-2 flex items-center justify-center gap-2 z-30 overflow-x-auto scrollbar-hide border-b border-white/10">
        <span className="text-white/60 text-[10px] sm:text-xs font-bold shrink-0 uppercase tracking-wider mr-1">Crop Ratio:</span>
        {[
          { key: 'free', label: 'Free Crop' },
          { key: '4:5', label: '4 : 5' },
          { key: '1:1', label: '1 : 1' },
          { key: '3:4', label: '3 : 4' },
          { key: 'full', label: 'Full Image' },
        ].map((btn) => (
          <button
            key={btn.key}
            onClick={() => handleAspectChange(btn.key as any)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
              aspectMode === btn.key
                ? 'bg-white text-black shadow-md scale-105'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Main Image Cropping Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center p-4 overflow-hidden touch-none"
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onMouseUp={handlePointerEnd}
        onTouchMove={(e) => {
          if (e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={handlePointerEnd}
      >
        <div className="relative inline-block max-w-full max-h-full">
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Captured Garment"
            onLoad={handleImageLoad}
            className="max-w-full max-h-[55vh] sm:max-h-[60vh] object-contain block mx-auto pointer-events-none rounded-lg"
          />

          {/* Dark Overlay around crop box */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              clipPath: `polygon(
                0% 0%, 0% 100%, 
                ${cropBox.x}% 100%, 
                ${cropBox.x}% ${cropBox.y}%, 
                ${cropBox.x + cropBox.w}% ${cropBox.y}%, 
                ${cropBox.x + cropBox.w}% ${cropBox.y + cropBox.h}%, 
                ${cropBox.x}% ${cropBox.y + cropBox.h}%, 
                ${cropBox.x}% 100%, 
                100% 100%, 100% 0%
              )`,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
            }}
          />

          {/* Interactive Free Crop Box */}
          <div
            className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] touch-none cursor-move"
            style={{
              left: `${cropBox.x}%`,
              top: `${cropBox.y}%`,
              width: `${cropBox.w}%`,
              height: `${cropBox.h}%`,
            }}
            onMouseDown={(e) => handlePointerStart('move', e.clientX, e.clientY)}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                handlePointerStart('move', e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
          >
            {/* Rule of Thirds Grid Lines */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
              <div className="border-r border-b border-white/60" />
              <div className="border-r border-b border-white/60" />
              <div className="border-b border-white/60" />
              <div className="border-r border-b border-white/60" />
              <div className="border-r border-b border-white/60" />
              <div className="border-b border-white/60" />
              <div className="border-r border-white/60" />
              <div className="border-r border-white/60" />
              <div />
            </div>

            {/* 4 Corner Touch Handles */}
            {['nw', 'ne', 'sw', 'se'].map((pos) => {
              const isTop = pos.includes('n');
              const isLeft = pos.includes('w');
              return (
                <div
                  key={pos}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handlePointerStart(pos, e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (e.touches.length > 0) {
                      handlePointerStart(pos, e.touches[0].clientX, e.touches[0].clientY);
                    }
                  }}
                  style={{
                    top: isTop ? '-14px' : 'auto',
                    bottom: !isTop ? '-14px' : 'auto',
                    left: isLeft ? '-14px' : 'auto',
                    right: !isLeft ? '-14px' : 'auto',
                  }}
                  className="absolute w-7 h-7 bg-white border-2 border-black rounded-full shadow-lg flex items-center justify-center z-20 cursor-pointer active:scale-125 transition-transform"
                >
                  <div className="w-2 h-2 bg-black rounded-full" />
                </div>
              );
            })}

            {/* 4 Edge Touch Handles */}
            {/* Top Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                handlePointerStart('n', e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (e.touches.length > 0) {
                  handlePointerStart('n', e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center cursor-pointer z-20"
            >
              <div className="w-8 h-2 bg-white border border-black rounded-full shadow-md" />
            </div>

            {/* Bottom Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                handlePointerStart('s', e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (e.touches.length > 0) {
                  handlePointerStart('s', e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center cursor-pointer z-20"
            >
              <div className="w-8 h-2 bg-white border border-black rounded-full shadow-md" />
            </div>

            {/* Left Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                handlePointerStart('w', e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (e.touches.length > 0) {
                  handlePointerStart('w', e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
              className="absolute top-1/2 -translate-y-1/2 -left-3 h-12 w-6 flex items-center justify-center cursor-pointer z-20"
            >
              <div className="h-8 w-2 bg-white border border-black rounded-full shadow-md" />
            </div>

            {/* Right Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                handlePointerStart('e', e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (e.touches.length > 0) {
                  handlePointerStart('e', e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
              className="absolute top-1/2 -translate-y-1/2 -right-3 h-12 w-6 flex items-center justify-center cursor-pointer z-20"
            >
              <div className="h-8 w-2 bg-white border border-black rounded-full shadow-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileScanner() {
  const { sessionId } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanSide, setScanSide] = useState<'front' | 'back'>('front');
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasCameraError, setHasCameraError] = useState(false);

  // Digital Pre-Crop Zoom
  const [preZoom, setPreZoom] = useState(1);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Post-Capture Cropper Pixel State
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const startCamera = useCallback(async (deviceId?: string, targetBadge?: string) => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
         const oldStream = videoRef.current.srcObject as MediaStream;
         oldStream.getTracks().forEach(track => {
            track.enabled = false;
            track.stop();
         });
         videoRef.current.srcObject = null;
      }
      setStream(null);
      await new Promise(r => setTimeout(r, 100));
      
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const track = mediaStream.getVideoTracks()[0];

      if (targetBadge && track && track.getCapabilities) {
         const caps = track.getCapabilities() as any;
         if (caps.zoom) {
            let z = 1;
            if (targetBadge === '0.5x') z = caps.zoom.min || 0.5;
            if (targetBadge === '2x') z = caps.zoom.max ? Math.min(2, caps.zoom.max) : 2;
            try {
              await track.applyConstraints({ advanced: [{ zoom: z }] } as any);
            } catch (e) {
              console.warn("Failed to apply native optical zoom on track", e);
            }
         }
      }

      setStream(mediaStream);
      setActiveDeviceId(deviceId || null);
      setHasCameraError(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(e => console.error("Playback error", e));
      }
    } catch (err) {
      console.error("Failed to switch camera:", err);
      setHasCameraError(true);
    }
  }, []);

  const initDevices = async () => {
    try {
      let tempStream: MediaStream | null = null;
      try {
         tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (permissionError) {
         console.warn("Could not get environment camera, requesting any video...");
         tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const devs = await navigator.mediaDevices.enumerateDevices();
      let vDevs = devs.filter(d => d.kind === 'videoinput');
      vDevs = Array.from(new Map(vDevs.map(d => [d.label || d.deviceId, d])).values());
      setVideoDevices(vDevs);
      
      if (tempStream) {
        tempStream.getTracks().forEach(t => t.stop());
      }
      
      const backIdx = vDevs.findIndex(d => d.label.toLowerCase().includes('back') && !d.label.toLowerCase().includes('ultra') && !d.label.toLowerCase().includes('telephoto'));
      if (backIdx >= 0) {
        startCamera(vDevs[backIdx].deviceId, '1x');
      } else if (vDevs.length > 0) {
        startCamera(vDevs[0].deviceId, '1x');
      } else {
        startCamera();
      }
    } catch (e) {
      console.error(e);
      startCamera();
    }
  };

  useEffect(() => {
    // Authenticate anonymously if not already signed in
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthLoading(false);
      } else {
        signInAnonymously(auth).catch(err => {
          console.error("Anonymous authentication failed", err);
          setIsAuthLoading(false);
        });
      }
    });

    initDevices();
    setIsInitializing(false);
    
    return () => {
      unsubscribeAuth();
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const cycleCamera = () => {
    if (videoDevices.length > 1) {
      const nextIdx = (currentDeviceIndex + 1) % videoDevices.length;
      setCurrentDeviceIndex(nextIdx);
      startCamera(videoDevices[nextIdx].deviceId);
    }
  };

  useEffect(() => {
    if (videoRef.current && stream && !capturedImage) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [capturedImage, stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const fw = video.videoWidth;
      const fh = video.videoHeight;
      const cropW = fw / preZoom;
      const cropH = fh / preZoom;
      const cropX = (fw - cropW) / 2;
      const cropY = (fh - cropH) / 2;

      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0); 
        setCapturedImage(dataUrl);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const submitPhoto = async () => {
    if (!capturedImage || !sessionId || !croppedAreaPixels) return;
    setIsUploading(true);
    try {
       // Bake the users crop settings into a final flat image URL
       const finalCroppedImageDataUrl = await getCroppedImg(capturedImage, croppedAreaPixels);

       const res = await fetch(finalCroppedImageDataUrl);
       const blob = await res.blob();
       const file = new File([blob], `scan_${sessionId}_${scanSide}.jpg`, { type: 'image/jpeg' });
       
       const uploadedUrl = await uploadGarmentImage(file, auth.currentUser?.uid || `${sessionId}_${scanSide}`);
       
       if (scanSide === 'front') {
         await updateScanSessionFront(sessionId, uploadedUrl);
         setScanSide('back');
         setCapturedImage(null);
       } else {
         await completeScanSession(sessionId, uploadedUrl);
         setSuccess(true);
       }
    } catch (err: any) {
      console.error("Upload failed", err);
      alert(`Failed to send image: ${err?.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <CheckCircle2 size={48} className="text-green-600" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">Scan Complete!</h1>
        <p className="text-gray-500 text-lg max-w-xs mx-auto">
          The garment image has been sent to your desktop securely. You can now close this tab.
        </p>
      </div>
    );
  }

  if (isInitializing || isAuthLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-gray-600 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-gray-400 font-sans">Initializing secure session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col overflow-hidden relative font-sans">
       {!capturedImage ? (
         <>
           <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             style={{ transform: `scale(${preZoom})`, transformOrigin: 'center center' }}
             className="w-full h-full object-cover absolute inset-0"
             onLoadedMetadata={() => videoRef.current?.play()}
           />
           
           <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
              <div className="bg-black/50 backdrop-blur-sm h-32 flex items-center justify-center pt-8 px-6">
                 <div className="text-center">
                   <h2 className="text-white font-serif text-xl font-bold tracking-wide uppercase">Scan {scanSide} of Garment</h2>
                   <p className="text-white/80 text-sm mt-1">Lay flat and align within the frame</p>
                 </div>
              </div>
              
              <div className="flex-1 flex items-center justify-center p-8">
                 <div className="w-full h-3/4 max-h-[500px] max-w-md relative">
                   <div className="absolute top-0 left-0 w-full h-1 bg-green-400 shadow-[0_0_15px_#4ade80] animate-scan-laser z-20" />
                   <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white/80 rounded-tl-xl" />
                   <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white/80 rounded-tr-xl" />
                   <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white/80 rounded-bl-xl" />
                   <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white/80 rounded-br-xl" />
                 </div>
              </div>
              
              <div className="bg-black/50 backdrop-blur-sm h-40 flex flex-col items-center justify-center pb-8 border-t border-white/10 relative">
                 <div className="absolute top-[-70px] left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2 pointer-events-auto shadow-lg border border-white/10">
                    <span className="text-white text-xs font-bold">Zoom</span>
                    <input 
                      type="range" 
                      min="1" max="3" step="0.1" 
                      value={preZoom} 
                      onChange={(e) => setPreZoom(parseFloat(e.target.value))} 
                      className="w-32 accent-white"
                    />
                 </div>

                 {videoDevices.length > 1 && (
                   <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto bg-black/70 p-1.5 rounded-full backdrop-blur-md border border-white/20 shadow-2xl">
                      {(() => {
                        const uniqueBadges = new Map();
                        videoDevices.forEach((device) => {
                           const l = device.label.toLowerCase();
                           let badge = '1x';
                           if (l.includes('ultra wide') || l.includes('ultrawide') || l.includes('0.5')) badge = '0.5x';
                           else if (l.includes('telephoto') || l.includes('2x')) badge = '2x';
                           else if (l.includes('front')) badge = 'Front';
                           else if (l.includes('back')) badge = '1x';
                           else badge = 'Cam';

                           if (!uniqueBadges.has(badge)) {
                             uniqueBadges.set(badge, { ...device, badge });
                           } else if (badge === '1x' && l === 'back camera') {
                             uniqueBadges.set(badge, { ...device, badge });
                           }
                        });

                        const sortedDevices = Array.from(uniqueBadges.values()).sort((a, b) => {
                           const order: Record<string, number> = { 'Front': 0, '0.5x': 1, '1x': 2, '2x': 3, 'Cam': 4 };
                           return order[a.badge] - order[b.badge];
                        });

                        return sortedDevices.map((d: any) => (
                           <button 
                             key={d.deviceId}
                             onClick={() => startCamera(d.deviceId, d.badge)}
                             className={`w-12 h-10 rounded-full text-xs font-bold flex flex-col items-center justify-center transition-all ${
                               activeDeviceId === d.deviceId 
                                 ? "bg-white text-black shadow-md scale-110" 
                                 : "bg-transparent text-white hover:bg-white/20"
                             }`}
                           >
                              {d.badge}
                           </button>
                        ));
                      })()}
                   </div>
                 )}

                 <div className="flex items-center justify-center w-full relative px-8 pointer-events-auto mt-6">
                   {hasCameraError ? (
                     <button onClick={() => startCamera()} className="bg-white text-black px-6 py-3 rounded-full font-bold shadow-lg">Retry Camera</button>
                   ) : (
                     <button 
                       onClick={capturePhoto} 
                       className="w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center p-1 active:scale-95 transition-transform"
                     >
                        <div className="w-full h-full bg-white rounded-full shadow-lg" />
                     </button>
                   )}
                 </div>
              </div>
           </div>
         </>
       ) : (
         /* Review & Crop UI */
         <div className="flex-1 flex flex-col bg-black absolute inset-0 z-20">
           {/* Header Mask */}
           <div className="bg-black/90 backdrop-blur-sm h-20 sm:h-24 flex items-center justify-center pt-4 px-6 z-30 pointer-events-none shrink-0 border-b border-white/10">
              <div className="text-center">
                <h2 className="text-white font-serif text-lg sm:text-xl font-bold tracking-wide uppercase">Crop {scanSide} of Garment</h2>
                <p className="text-white/80 text-xs sm:text-sm mt-0.5">Drag corners or sides freely to frame your garment</p>
              </div>
           </div>

           <div className="flex-1 relative bg-black w-full h-full min-h-0">
             <FreeCropper
               imageSrc={capturedImage}
               onCropComplete={(pixels) => setCroppedAreaPixels(pixels)}
             />
           </div>

           <div className="h-32 sm:h-36 bg-white flex flex-col items-center px-6 rounded-t-3xl border-t border-gray-200 z-30 pt-4 shrink-0 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
             <div className="flex items-center justify-around w-full max-w-md">
               <button 
                 onClick={retakePhoto}
                 disabled={isUploading}
                 className="flex flex-col items-center justify-center text-gray-500 font-medium py-2 px-4 disabled:opacity-50"
               >
                 <RefreshCw size={22} className="mb-1" />
                 <span className="text-xs">Retake</span>
               </button>
               <button 
                 onClick={submitPhoto}
                 disabled={isUploading}
                 className="bg-black text-white px-8 sm:px-10 py-3.5 rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-gray-900 active:scale-95 transition-all outline-none disabled:opacity-50 text-sm sm:text-base"
               >
                 {isUploading ? (
                   <>
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                     {scanSide === 'front' ? 'Processing...' : 'Sending...'}
                   </>
                 ) : (
                   <>
                     <Camera size={18} />
                     {scanSide === 'front' ? 'Proceed to Back' : 'Finish & Upload'}
                   </>
                 )}
               </button>
             </div>
           </div>
         </div>
       )}

       <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
