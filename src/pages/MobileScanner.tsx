import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { completeScanSession, uploadGarmentImage } from '../services/dbService';
import { Camera, CheckCircle2, RefreshCw } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';

export function MobileScanner() {
  const { sessionId } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasCameraError, setHasCameraError] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
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

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
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
       const file = new File([blob], `scan_${sessionId}.jpg`, { type: 'image/jpeg' });
       
       // Upload to firebase (using sessionId as dummy userId for folder isolation)
       const uploadedUrl = await uploadGarmentImage(file, sessionId);
       
       // Update scan session
       await completeScanSession(sessionId, uploadedUrl);
       setSuccess(true);
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
             className="w-full h-full object-cover absolute inset-0"
             onLoadedMetadata={() => videoRef.current?.play()}
           />
           
           {/* Overlays to simulate "check scanner" AI detection boundary */}
           <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
              {/* Header Mask */}
              <div className="bg-black/50 backdrop-blur-sm h-32 flex items-center justify-center pt-8 px-6">
                 <div className="text-center">
                   <h2 className="text-white font-serif text-xl font-bold tracking-wide">Scan Garment</h2>
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
              <div className="bg-black/50 backdrop-blur-sm h-40 flex items-center justify-center pb-8 border-t border-white/10">
                 {hasCameraError ? (
                   <button onClick={startCamera} className="bg-white text-black px-6 py-3 rounded-full font-bold shadow-lg">Retry Camera</button>
                 ) : (
                   <button 
                     onClick={capturePhoto} 
                     className="w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center p-1 pointer-events-auto active:scale-95 transition-transform"
                   >
                      <div className="w-full h-full bg-white rounded-full shadow-lg" />
                   </button>
                 )}
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
                   Sending...
                 </>
               ) : (
                 <>
                   <Camera size={20} />
                   Send to Desktop
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
