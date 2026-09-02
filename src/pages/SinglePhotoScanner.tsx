import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { uploadGarmentImage } from '../services/dbService';
import { Camera, CheckCircle2, RefreshCw } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FreeCropper } from './MobileScanner';

// Helper function to extract the visually cropped portion of the image into a high-res 2K JPEG
const getCroppedImg = async (imageSrc: string, pixelCrop: { x: number; y: number; width: number; height: number }): Promise<string> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise(resolve => image.onload = resolve);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx || !pixelCrop || !pixelCrop.width || !pixelCrop.height) return imageSrc;

  // Scale crops up to crisp 2K resolution (up to 2048px) matching original scans
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

export function SinglePhotoScanner() {
  const { sessionId } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasCameraError, setHasCameraError] = useState(false);

  const [preZoom, setPreZoom] = useState(1);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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
    // Lock body scrolling on mobile so page cannot shift when rotating phone
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';

    const handleOrientationOrResize = () => {
      window.scrollTo(0, 0);
      setTimeout(() => window.scrollTo(0, 0), 100);
      setTimeout(() => window.scrollTo(0, 0), 300);
    };

    window.addEventListener('orientationchange', handleOrientationOrResize);
    window.addEventListener('resize', handleOrientationOrResize);

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
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
      window.removeEventListener('orientationchange', handleOrientationOrResize);
      window.removeEventListener('resize', handleOrientationOrResize);
      unsubscribeAuth();
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

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
       const finalCroppedImageDataUrl = await getCroppedImg(capturedImage, croppedAreaPixels);

       const res = await fetch(finalCroppedImageDataUrl);
       const blob = await res.blob();
       const file = new File([blob], `gallery_scan_${sessionId}.jpg`, { type: 'image/jpeg' });
       
       const uploadedUrl = await uploadGarmentImage(file, auth.currentUser?.uid || `gallery_scan_${sessionId}`);
       
       await setDoc(doc(db, 'companionUploads', sessionId), {
         imageUrl: uploadedUrl,
         timestamp: serverTimestamp()
       });
       
       setSuccess(true);
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
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">Photo Uploaded!</h1>
        <p className="text-gray-500 text-lg max-w-xs mx-auto">
          The photo has been added to your tech pack gallery. You can now close this tab.
        </p>
      </div>
    );
  }

  if (isInitializing || isAuthLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-gray-600 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-gray-400 font-sans">Initializing camera session...</p>
      </div>
    );
  }

  return (
    <div className="h-screen h-[100dvh] bg-black flex flex-col overflow-hidden relative font-sans w-full">
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
              <div className="bg-black/50 backdrop-blur-sm h-24 sm:h-28 landscape:h-12 flex items-center justify-center pt-6 sm:pt-8 landscape:pt-1 px-6">
                 <div className="text-center">
                   <h2 className="text-white font-serif text-lg sm:text-xl landscape:text-sm font-bold tracking-wide uppercase">Snap Garment Photo</h2>
                   <p className="text-white/80 text-xs sm:text-sm landscape:hidden mt-0.5">Center your garment in the frame</p>
                 </div>
              </div>
              
              <div className="flex-1 flex items-center justify-center p-4 sm:p-8 min-h-0">
                 <div className="w-full h-3/4 max-h-[500px] max-w-md landscape:max-h-[220px] landscape:max-w-lg relative">
                   <div className="absolute top-0 left-0 w-full h-1 bg-green-400 shadow-[0_0_15px_#4ade80] animate-scan-laser z-20" />
                   <div className="absolute top-0 left-0 w-8 sm:w-12 h-8 sm:h-12 border-t-4 border-l-4 border-white/80 rounded-tl-xl" />
                   <div className="absolute top-0 right-0 w-8 sm:w-12 h-8 sm:h-12 border-t-4 border-r-4 border-white/80 rounded-tr-xl" />
                   <div className="absolute bottom-0 left-0 w-8 sm:w-12 h-8 sm:h-12 border-b-4 border-l-4 border-white/80 rounded-bl-xl" />
                   <div className="absolute bottom-0 right-0 w-8 sm:w-12 h-8 sm:h-12 border-b-4 border-r-4 border-white/80 rounded-br-xl" />
                 </div>
              </div>
              
              <div className="bg-black/50 backdrop-blur-sm h-32 sm:h-40 landscape:h-16 flex flex-col items-center justify-center pb-4 sm:pb-8 landscape:pb-1 border-t border-white/10 relative">
                 <div className="absolute top-[-55px] sm:top-[-70px] landscape:top-[-38px] left-1/2 -translate-x-1/2 bg-black/60 px-3 sm:px-4 py-1 sm:py-2 rounded-full backdrop-blur-md flex items-center gap-2 pointer-events-auto shadow-lg border border-white/10 scale-90 sm:scale-100">
                    <span className="text-white text-xs font-bold">Zoom</span>
                    <input 
                      type="range" 
                      min="1" max="3" step="0.1" 
                      value={preZoom} 
                      onChange={(e) => setPreZoom(parseFloat(e.target.value))} 
                      className="w-24 sm:w-32 accent-white cursor-pointer"
                    />
                 </div>

                 {videoDevices.length > 1 && (
                   <div className="absolute top-[-22px] sm:top-[-30px] landscape:top-[-18px] left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-auto bg-black/70 p-1 rounded-full backdrop-blur-md border border-white/20 shadow-2xl scale-90 sm:scale-100">
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
                             className={`w-10 sm:w-12 h-8 sm:h-10 rounded-full text-xs font-bold flex flex-col items-center justify-center transition-all ${
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

                 <div className="flex items-center justify-center w-full relative px-8 pointer-events-auto mt-2 sm:mt-6 landscape:mt-1">
                   {hasCameraError ? (
                     <button onClick={() => startCamera()} className="bg-white text-black px-6 py-2.5 rounded-full font-bold shadow-lg text-xs sm:text-sm">Retry Camera</button>
                   ) : (
                     <button 
                       onClick={capturePhoto} 
                       className="w-14 h-14 sm:w-20 sm:h-20 landscape:w-11 landscape:h-11 rounded-full border-4 border-white/80 flex items-center justify-center p-1 active:scale-95 transition-transform"
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
         <div className="fixed inset-0 z-50 flex flex-col bg-black h-full w-full h-[100dvh] overflow-hidden">
           {/* Header Mask */}
           <div className="bg-black/90 backdrop-blur-sm py-2 sm:py-3 px-4 z-30 shrink-0 border-b border-white/10 flex flex-col items-center justify-center">
              <div className="text-center">
                <h2 className="text-white font-serif text-base sm:text-xl landscape:text-xs font-bold tracking-wide uppercase">Crop Photo</h2>
                <p className="text-white/80 text-xs sm:text-sm landscape:hidden mt-0.5">Drag corners or sides freely to frame your photo</p>
              </div>
           </div>

           <div className="flex-1 relative bg-black w-full min-h-0 overflow-hidden pb-20 sm:pb-24">
             <FreeCropper
               imageSrc={capturedImage}
               onCropComplete={(pixels) => setCroppedAreaPixels(pixels)}
             />
           </div>

           {/* Fixed Bottom Action Bar: Always anchored to viewport bottom regardless of phone rotation */}
           <div className="fixed bottom-0 inset-x-0 bg-white flex flex-col items-center px-4 sm:px-6 rounded-t-2xl sm:rounded-t-3xl border-t border-gray-200 z-[60] py-3 sm:py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
             <div className="flex items-center justify-around w-full max-w-md">
               <button 
                 onClick={retakePhoto}
                 disabled={isUploading}
                 className="flex flex-col items-center justify-center text-gray-500 font-medium py-1 px-3 disabled:opacity-50"
               >
                 <RefreshCw size={18} className="mb-0.5 sm:mb-1" />
                 <span className="text-[10px] sm:text-xs">Retake</span>
               </button>
               <button 
                 onClick={submitPhoto}
                 disabled={isUploading}
                 className="bg-black text-white px-6 sm:px-10 py-2.5 sm:py-3.5 landscape:py-2 landscape:px-6 rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-gray-900 active:scale-95 transition-all outline-none disabled:opacity-50 text-xs sm:text-base"
               >
                 {isUploading ? (
                   <>
                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                     Sending...
                   </>
                 ) : (
                   <>
                     <Camera size={16} />
                     Finish & Upload
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
