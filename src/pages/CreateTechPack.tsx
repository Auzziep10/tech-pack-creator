import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { ImageUpload } from '../components/upload/ImageUpload';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { analyzeGarmentForMeasurement, generateTechPack } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { uploadGarmentImage, createScanSession } from '../services/dbService';
import { deleteQueueItem } from '../services/wovnService';
import { QRCodeSVG } from 'qrcode.react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

type FlowStep = 'upload' | 'analyzing' | 'requestMeasurement' | 'generating' | 'done';

export function CreateTechPack() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<FlowStep>('upload');
  const [images, setImages] = useState<{file: File | null, frontUrl: string, backUrl: string} | null>(null);
  const queueItem = location.state?.queueItem;
  
  const [garmentType, setGarmentType] = useState('Product');
  const [anchors, setAnchors] = useState<any[]>([]);
  const [anchorValues, setAnchorValues] = useState<Record<string, string>>({});
  const [baseSize, setBaseSize] = useState('Medium');
  const [sessionId, setSessionId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let unsubscribe: () => void;
    
    const initSession = async () => {
      try {
        const newSessionId = await createScanSession(user.uid);
        setSessionId(newSessionId);
        
        unsubscribe = onSnapshot(doc(db, 'scanSessions', newSessionId), (snapshot) => {
          const data = snapshot.data();
          if (data && data.status === 'completed' && data.frontImageUrl && data.backImageUrl) {
            handleImageSelected(null, data.frontImageUrl, data.backImageUrl);
          }
        });
      } catch (err) {
        console.error("Failed to create scan session", err);
      }
    };
    
    initSession();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const handleImageSelected = (file: File | null, frontUrl: string, backUrl: string = '') => {
    setImages({ file, frontUrl, backUrl });
    // Auto-advance to next step
    startAnalysis(frontUrl, backUrl);
  };

  const startAnalysis = async (frontUrl: string, backUrl: string) => {
    setStep('analyzing');
    try {
      const result = await analyzeGarmentForMeasurement(frontUrl, backUrl);
      setGarmentType(result.type || 'Product');
      setAnchors(result.anchors && result.anchors.length > 0 ? result.anchors : [
        { id: 'chest', label: 'Chest Width (cm)', description: 'Measure straight across from 2.5cm below the armhole seam to opposite side.'},
        { id: 'length', label: 'Front Body Length (cm)', description: 'Measure straight down from High Point Shoulder (HPS) seam to bottom edge.'}
      ]);
      setAnchorValues({});
      setStep('requestMeasurement');
    } catch (e) {
      console.error(e);
      setGarmentType('T-Shirt / Basic Garment');
      setAnchors([
        { id: 'chest', label: 'Chest Width (cm)', description: 'Measure straight across from 2.5cm below the armhole seam to opposite side.'},
        { id: 'length', label: 'Front Body Length (cm)', description: 'Measure straight down from High Point Shoulder (HPS) seam to bottom edge.'}
      ]);
      setStep('requestMeasurement');
    }
  };

  const handleGenerateTechPack = async () => {
    if (!images || anchors.some(a => !anchorValues[a.id]?.trim())) return;
    setStep('generating');
    try {
      const data = await generateTechPack(
        images.frontUrl, 
        images.backUrl, 
        anchors, 
        anchorValues, 
        baseSize, 
        queueItem?.wovnItem?.garment_name || garmentType,
        queueItem?.wovnItem
      );
      
      let finalImageUrl = images.frontUrl;
      if (images.file && user) {
         try {
           finalImageUrl = await uploadGarmentImage(images.file, user.uid);
         } catch (uploadErr) {
           console.error("Storage upload failed, falling back to local base64:", uploadErr);
         }
      }

      // Automatically add both front and back photos into the editor's initial gallery array
      const initialGallery = [finalImageUrl];
      if (images.backUrl) {
         initialGallery.push(images.backUrl);
      }
      if (!data.gallery) data.gallery = initialGallery;

      // Delete item from queue if from Wovn integration
      if (queueItem?.id) {
        try {
          await deleteQueueItem(queueItem.id);
        } catch (e) {
          console.error("Failed to clear queue item", e);
        }
      }

      setStep('done');
      navigate('/pack/draft', { state: { image: finalImageUrl, techPack: data } });
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to generate tech pack. Check console for details.");
      setStep('requestMeasurement'); // Revert on error
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-4xl font-serif font-bold tracking-tight text-gray-900">
          {queueItem ? `Process ${queueItem.wovnItem?.garment_name}` : 'Create Tech Pack'}
        </h1>
        <p className="text-gray-500 mt-1 text-lg">
          {queueItem ? 'Scan the physical garment to finalize the import and generate specs.' : 'Upload a garment mockup to begin analysis.'}
        </p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        {[
          { id: 'upload', label: 'Upload' },
          { id: 'requestMeasurement', label: 'Anchor' },
          { id: 'done', label: 'Review' }
        ].map((s, i) => {
          const isActive = step === s.id;
          const isPast = ['analyzing', 'requestMeasurement', 'generating', 'done'].includes(step) && s.id === 'upload';
          
          return (
            <div key={s.id} className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                isActive ? 'bg-black border-black text-white' :
                isPast ? 'bg-gray-100 border-gray-300 text-gray-900' :
                'border-gray-200 text-gray-400 bg-white'
              }`}>
                {isPast ? <CheckCircle2 size={16} /> : <span className="font-bold text-xs">{i + 1}</span>}
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {i < 2 && <ArrowRight size={16} className="text-gray-600" />}
            </div>
          );
        })}
      </div>

      <GlassCard className="p-8 shadow-sm border border-gray-200 bg-white">
        {(step === 'upload' || step === 'analyzing') && (
          <div className="space-y-6">
            <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-6">Upload Mockup</h2>
            
            <div className="flex flex-col md:flex-row gap-8 items-stretch">
              <div className="flex-1">
                 <ImageUpload onImageSelected={(file, url) => handleImageSelected(file, url, '')} />
              </div>
              
              <div className="w-px bg-gray-200 hidden md:block" />
              
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-2xl border border-gray-200">
                 <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm mb-4">
                   {sessionId ? (
                     <QRCodeSVG value={`${window.location.origin}/scan/${sessionId}`} size={160} />
                   ) : (
                     <div className="w-40 h-40 bg-gray-100 animate-pulse rounded-xl" />
                   )}
                 </div>
                 <h3 className="font-serif font-bold text-gray-900 text-xl">Scan to Capture</h3>
                 <p className="text-gray-500 text-sm mt-2 max-w-[250px]">
                   Use your phone's camera to seamlessly scan your garment laid out flat.
                 </p>
              </div>
            </div>
            
            {step === 'analyzing' && (
              <div className="flex flex-col items-center justify-center py-12 animate-in fade-in">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-black animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto text-black animate-pulse" size={20} />
                </div>
                <h3 className="text-xl font-serif mt-6 text-gray-900 text-center">Vision Analysis</h3>
                <p className="text-gray-500 mt-2 text-center max-w-sm">
                  Scanning garment details, construction features, and silhouette...
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'requestMeasurement' && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
             <div className="flex gap-8">
                <div className="w-1/3 shrink-0 flex flex-col gap-2">
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 relative p-4 h-64">
                    <img src={images?.frontUrl} alt="Mockup Front" className="w-full h-full object-contain aspect-square mix-blend-multiply" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                       <CheckCircle2 size={16} className="text-green-600" />
                       <span className="text-xs font-semibold tracking-wide text-gray-900">FRONT</span>
                    </div>
                  </div>
                  {images?.backUrl && (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 relative p-4 h-64">
                      <img src={images.backUrl} alt="Mockup Back" className="w-full h-full object-contain aspect-square mix-blend-multiply" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                         <CheckCircle2 size={16} className="text-green-600" />
                         <span className="text-xs font-semibold tracking-wide text-gray-900">BACK</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="w-2/3 flex flex-col justify-center gap-6">
                   <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 relative overflow-hidden">
                     <div className="absolute -right-4 -top-4 text-gray-200"><Sparkles size={100} /></div>
                     <h3 className="text-2xl font-serif text-gray-900 mb-2 relative z-10">Detected: {garmentType}</h3>
                     <p className="text-gray-600 text-sm leading-relaxed relative z-10">
                       To eliminate camera lens distortion and assure millimeter accuracy, please provide the horizontal and vertical anchor measurements for your base size.
                     </p>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                     <div className="space-y-2">
                       <label className="text-sm font-medium text-gray-700 block">Base Size</label>
                       <div className="relative">
                         <select
                           value={baseSize}
                           onChange={(e) => setBaseSize(e.target.value)}
                           className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black transition-colors appearance-none cursor-pointer h-10"
                         >
                           {['XS', 'Small', 'Medium', 'Large', 'XL', '2XL', '3XL', 'One Size', 'Other'].map(size => (
                             <option key={size} value={size}>{size}</option>
                           ))}
                         </select>
                         <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                       </div>
                     </div>
                     {anchors.map((anchor, i) => (
                       <div key={anchor.id} className="space-y-2">
                         <Input 
                           label={anchor.label}
                           placeholder="e.g. 55"
                           value={anchorValues[anchor.id] || ''}
                           onChange={e => setAnchorValues(prev => ({...prev, [anchor.id]: e.target.value}))}
                           autoFocus={i === 0}
                         />
                         <p className="text-[11px] text-gray-500 leading-snug">
                           {anchor.description}
                         </p>
                       </div>
                     ))}
                   </div>
                   
                   <div className="pt-4 flex justify-end">
                     <Button 
                       onClick={handleGenerateTechPack} 
                       disabled={anchors.some(a => !anchorValues[a.id]?.trim()) || anchors.length === 0} 
                       size="lg" 
                       className="gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                     >
                       <Sparkles size={18} />
                       Generate Tech Pack
                     </Button>
                   </div>
                </div>
             </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
             <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-gray-200 border-t-black animate-spin" />
                <Sparkles className="absolute inset-0 m-auto text-black animate-pulse" size={28} />
             </div>
             <h3 className="text-3xl font-serif mt-6 text-gray-900 text-center">Drafting the Tech Pack</h3>
             <p className="text-gray-500 mt-2 text-center max-w-sm">
               Calculating proportional measurements, calling out construction details, and identifying fabric...
             </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
