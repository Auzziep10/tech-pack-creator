import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, CheckCircle2 } from 'lucide-react';
import { uploadGarmentImage } from '../services/dbService';
import { db } from '../services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export function QuickCameraScanner() {
  const { sessionId } = useParams();
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      try {
        const file = e.target.files[0];
        const uploadedUrl = await uploadGarmentImage(file, `detail_scan_${sessionId}`);
        
        await setDoc(doc(db, 'companionUploads', sessionId!), {
          imageUrl: uploadedUrl,
          timestamp: serverTimestamp()
        });
        
        setSuccess(true);
      } catch (err) {
        console.error("Camera upload failed", err);
        alert("Failed to send image. Please try again.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <CheckCircle2 size={48} className="text-green-600" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">Photo Captured!</h1>
        <p className="text-gray-500 text-lg max-w-xs mx-auto">
          The image has been instantly sent to your desktop. You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center font-sans p-6">
      <div className="text-center mb-10">
        <h1 className="text-white text-3xl font-serif font-bold mb-2">Garment Quick-Cam</h1>
        <p className="text-gray-400">Take a closeup photo to sync to your computer.</p>
      </div>
      
      <label className={`w-64 h-64 rounded-full border-4 ${isUploading ? 'border-gray-500 bg-gray-800' : 'border-white bg-white hover:scale-105 active:scale-95'} transition-all flex flex-col items-center justify-center cursor-pointer shadow-[0_0_40px_rgba(255,255,255,0.2)]`}>
        {isUploading ? (
          <>
            <div className="w-10 h-10 border-4 border-gray-600 border-t-white rounded-full animate-spin mb-4" />
            <span className="text-white font-bold tracking-wider uppercase text-sm">Syncing...</span>
          </>
        ) : (
          <>
            <Camera size={64} className="text-black mb-2" />
            <span className="text-black font-bold tracking-wider uppercase">Open Camera</span>
          </>
        )}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          onChange={handleCapture}
          disabled={isUploading}
        />
      </label>
    </div>
  );
}
