import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { completeScanSession, updateScanSessionFront, uploadGarmentImage } from '../services/dbService';
import { Camera, CheckCircle2, RefreshCw } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';

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

  const [zoom, setZoom] = useState(1);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      // 1. Force completely release the hardware track directly from the video DOM object
      if (videoRef.current && videoRef.current.srcObject) {
         const oldStream = videoRef.current.srcObject as MediaStream;
         oldStream.getTracks().forEach(track => {
            track.enabled = false;
            track.stop();
         });
         videoRef.current.srcObject = null;
      }
      
      // 2. Clear massive memory locks in iOS Safari
      setStream(null);

      // 3. Apple's WebKit requires a tiny hardware flush window (100ms) to literally switch physical rear sensors!
      await new Promise(r => setTimeout(r, 100));
      
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
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
      // 1. Apple Safari strictly restricts device enumeration until the user grants explicit camera permission.
      // We must start a temporary video stream FIRST to trigger the native iOS permission popup!
      let tempStream: MediaStream | null = null;
      try {
         tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (permissionError) {
         console.warn("Could not get environment camera, requesting any video...");
         tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      // 2. Now that permission is granted, iOS Safari will securely unlock all hardware lenses (Ultra Wide, Telephoto, Front)
      const devs = await navigator.mediaDevices.enumerateDevices();
      let vDevs = devs.filter(d => d.kind === 'videoinput');
      
      // Deduplicate any glitchy redundant lenses provided by Safari
      vDevs = Array.from(new Map(vDevs.map(d => [d.label || d.deviceId, d])).values());
      setVideoDevices(vDevs);
      
      // Cleanup the temporary stream so we don't hold dual locks
      if (tempStream) {
        tempStream.getTracks().forEach(t => t.stop());
      }
      
      // Safely snap onto the standard back camera to begin
      const backIdx = vDevs.findIndex(d => d.label.toLowerCase().includes('back') && !d.label.toLowerCase().includes('ultra') && !d.label.toLowerCase().includes('telephoto'));
      if (backIdx >= 0) {
        startCamera(vDevs[backIdx].deviceId);
      } else if (vDevs.length > 0) {
        startCamera(vDevs[0].deviceId);
      } else {
        startCamera();
      }
    } catch (e) {
      console.error(e);
      startCamera();
    }
  };

  useEffect(() => {
    initDevices();
    setIsInitializing(false);
    
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []); // Only run once on mount

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
      const cropW = fw / zoom;
      const cropH = fh / zoom;
      const cropX = (fw - cropW) / 2;
      const cropY = (fh - cropH) / 2;

      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the zoomed sub-rectangle onto the tight canvas
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0); // 100% Quality
        setCapturedImage(dataUrl);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const submitPhoto = async () => {
    if (!capturedImage || !sessionId) return;
    setIsUploading(true);
    try {
       // Convert base64 to file
       const res = await fetch(capturedImage);
       const blob = await res.blob();
       const file = new File([blob], `scan_${sessionId}_${scanSide}.jpg`, { type: 'image/jpeg' });
       
       // Upload to firebase (using sessionId as dummy userId for folder isolation)
       const uploadedUrl = await uploadGarmentImage(file, `${sessionId}_${scanSide}`);
       
       if (scanSide === 'front') {
         await updateScanSessionFront(sessionId, uploadedUrl);
         setScanSide('back');
         setCapturedImage(null);
       } else {
         await completeScanSession(sessionId, uploadedUrl);
         setSuccess(true);
       }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to send image. Please try again.");
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

  if (isInitializing) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black flex flex-col overflow-hidden relative font-sans">
       {/* Scanner UI */}
       {!capturedImage ? (
         <>
           <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
             className="w-full h-full object-cover absolute inset-0"
             onLoadedMetadata={() => videoRef.current?.play()}
           />
           
           {/* Overlays to simulate "check scanner" AI detection boundary */}
           <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
              {/* Header Mask */}
              <div className="bg-black/50 backdrop-blur-sm h-32 flex items-center justify-center pt-8 px-6">
                 <div className="text-center">
                   <h2 className="text-white font-serif text-xl font-bold tracking-wide uppercase">Scan {scanSide} of Garment</h2>
                   <p className="text-white/80 text-sm mt-1">Lay flat and align within the frame</p>
                 </div>
              </div>
              
              {/* Frame target */}
              <div className="flex-1 flex items-center justify-center p-8">
                 <div className="w-full h-3/4 max-h-[500px] max-w-md relative">
                   {/* Scanning Laser Animation */}
                   <div className="absolute top-0 left-0 w-full h-1 bg-green-400 shadow-[0_0_15px_#4ade80] animate-scan-laser z-20" />
                   
                   {/* Corner Borders */}
                   <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white/80 rounded-tl-xl" />
                   <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white/80 rounded-tr-xl" />
                   <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white/80 rounded-bl-xl" />
                   <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white/80 rounded-br-xl" />
                 </div>
              </div>
              
              {/* Footer Mask */}
              <div className="bg-black/50 backdrop-blur-sm h-40 flex flex-col items-center justify-center pb-8 border-t border-white/10 relative">
                 
                  {/* Zoom Slider (Digital Custom Cropping) */}
                 <div className="absolute top-[-70px] left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2 pointer-events-auto shadow-lg border border-white/10">
                    <span className="text-white text-xs font-bold">Zoom</span>
                    <input 
                      type="range" 
                      min="1" max="3" step="0.1" 
                      value={zoom} 
                      onChange={(e) => setZoom(parseFloat(e.target.value))} 
                      className="w-32 accent-white"
                    />
                 </div>

                 {/* Native Lens Selection (0.5x, 1x, Front) */}
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

                           // Prioritize pure "back camera" for 1x over "virtual" multi-camera arrays if seen
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
                             onClick={() => startCamera(d.deviceId)}
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
                   
                   {/* Center Capture */}
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
         /* Review UI */
         <div className="flex-1 flex flex-col bg-black absolute inset-0 z-20">
           <div className="flex-1 relative p-4 flex items-center justify-center bg-gray-900">
             <img src={capturedImage} alt="Captured garment" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
           </div>
           <div className="h-32 bg-white flex items-center justify-around px-6 rounded-t-3xl border-t border-gray-200">
             <button 
               onClick={retakePhoto}
               disabled={isUploading}
               className="flex flex-col items-center justify-center text-gray-500 font-medium py-2 px-4 disabled:opacity-50"
             >
               <RefreshCw size={24} className="mb-1" />
               Retake
             </button>
             <button 
               onClick={submitPhoto}
               disabled={isUploading}
               className="bg-black text-white px-10 py-4 rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-gray-900 active:scale-95 transition-all outline-none disabled:opacity-50"
             >
               {isUploading ? (
                 <>
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   {scanSide === 'front' ? 'Saving...' : 'Sending to Desktop...'}
                 </>
               ) : (
                 <>
                   <Camera size={20} />
                   {scanSide === 'front' ? 'Accept Front Image' : 'Finish & Upload'}
                 </>
               )}
             </button>
           </div>
         </div>
       )}

       <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
