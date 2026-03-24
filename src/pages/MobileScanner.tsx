import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { completeScanSession, updateScanSessionFront, uploadGarmentImage } from '../services/dbService';
import { Camera, CheckCircle2, RefreshCw, Box } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { WebXRLidar } from '../components/scanner/WebXRLidar';

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
  const [showXrPrompt, setShowXrPrompt] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isArMode, setIsArMode] = useState(false);
  const [arMeasurements, setArMeasurements] = useState<any[]>([]);

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasCameraError(false);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setHasCameraError(true);
    }
  }, [stream]);

  const initDevices = async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const vDevs = devs.filter(d => d.kind === 'videoinput');
      setVideoDevices(vDevs);
      
      // Find back camera index if possible
      const backIdx = vDevs.findIndex(d => d.label.toLowerCase().includes('back'));
      if (backIdx >= 0) {
        setCurrentDeviceIndex(backIdx);
        startCamera(vDevs[backIdx].deviceId);
      } else {
        startCamera(vDevs[0]?.deviceId);
      }
    } catch (e) {
      startCamera();
    }
  };

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isWebXRViewer = /WebXRViewer/i.test(navigator.userAgent);
    
    if (isIOS && !isWebXRViewer) {
      setShowXrPrompt(true);
    } else {
      initDevices();
    }
    setIsInitializing(false);
    
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
         await updateScanSessionFront(sessionId, uploadedUrl, arMeasurements);
         setScanSide('back');
         setCapturedImage(null);
         setArMeasurements([]);
       } else {
         await completeScanSession(sessionId, uploadedUrl, arMeasurements);
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

  if (showXrPrompt) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="bg-gray-900 p-8 rounded-3xl max-w-sm w-full border border-gray-800 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
            <Camera size={32} className="text-indigo-400" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-white mb-3">Want 3D LiDAR Measurements?</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Apple restricts LiDAR mapping technology inside standard Safari browsers. To calculate hyper-accurate real world depth maps of this garment, you must open this scan link using the <b>WebXR Viewer</b> app natively built by Mozilla.
          </p>
          <div className="space-y-4">
            <a 
              href="https://apps.apple.com/us/app/webxr-viewer/id1298888090" 
              target="_blank"
              rel="noreferrer"
              className="block w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
            >
              Get WebXR Viewer App
            </a>
            <button 
              onClick={() => {
                setShowXrPrompt(false);
                initDevices();
              }}
              className="block w-full bg-transparent text-gray-400 font-bold py-3 rounded-xl border border-gray-700 hover:bg-gray-800 hover:text-white transition-colors"
            >
              Continue without LiDAR
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isArMode) {
    return (
      <WebXRLidar 
        onComplete={(measurements) => {
          setArMeasurements(prev => [...prev, ...measurements]);
          setIsArMode(false);
        }} 
        onCancel={() => setIsArMode(false)} 
      />
    );
  }

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
                 
                 {/* Zoom Slider */}
                 <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2 pointer-events-auto">
                    <span className="text-white text-xs font-bold">1x</span>
                    <input 
                      type="range" 
                      min="1" max="3" step="0.1" 
                      value={zoom} 
                      onChange={(e) => setZoom(parseFloat(e.target.value))} 
                      className="w-32"
                    />
                    <span className="text-white text-xs font-bold">3x</span>
                 </div>

                 <div className="flex items-center justify-center w-full relative px-8 pointer-events-auto">
                   {/* Left side flip camera */}
                   {videoDevices.length > 1 && (
                     <button onClick={cycleCamera} className="absolute left-8 bg-white/20 p-3 rounded-full text-white active:scale-95 transition-transform">
                        <RefreshCw size={24} />
                     </button>
                   )}
                   
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

                   {/* Right side AR toggle (if supported device browser like Android Chrome or WebXR Viewer) */}
                   <button onClick={() => setIsArMode(true)} className="absolute right-8 bg-indigo-500/80 p-3 rounded-full text-white active:scale-95 transition-transform flex items-center shadow-[0_0_15px_#6366f1]">
                      <Box size={24} />
                   </button>
                 </div>
              </div>
           </div>
         </>
       ) : (
         /* Review UI */
         <div className="flex-1 flex flex-col bg-black absolute inset-0 z-20">
           <div className="flex-1 relative p-4 flex items-center justify-center bg-gray-900">
             <img src={capturedImage} alt="Captured garment" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
             {arMeasurements.length > 0 && (
               <div className="absolute top-8 left-8 bg-black/60 backdrop-blur-md p-4 rounded-xl shadow-lg border border-indigo-500/30">
                 <h4 className="text-white font-bold mb-2 text-sm flex items-center gap-2"><Box size={14} className="text-indigo-400"/> LiDAR Data Captured:</h4>
                 <div className="space-y-1">
                   {arMeasurements.map((m, i) => <div key={i} className="text-indigo-200 text-xs font-mono">{m.distance} cm matched</div>)}
                 </div>
               </div>
             )}
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
