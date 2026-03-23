import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { ImageUpload } from '../components/upload/ImageUpload';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { analyzeGarmentForMeasurement, generateTechPack } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { uploadGarmentImage } from '../services/dbService';

type FlowStep = 'upload' | 'analyzing' | 'requestMeasurement' | 'generating' | 'done';

export function CreateTechPack() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<FlowStep>('upload');
  const [image, setImage] = useState<{file: File, url: string} | null>(null);
  
  const [anchorName, setAnchorName] = useState('');
  const [anchorValue, setAnchorValue] = useState('');
  
  const handleImageSelected = (file: File, url: string) => {
    setImage({ file, url });
    // Auto-advance to next step
    startAnalysis(url);
  };

  const startAnalysis = async (imageUrl: string) => {
    setStep('analyzing');
    try {
      const measurementNeeded = await analyzeGarmentForMeasurement(imageUrl);
      setAnchorName(measurementNeeded);
      setStep('requestMeasurement');
    } catch (e) {
      console.error(e);
      setAnchorName('Chest Width');
      setStep('requestMeasurement');
    }
  };

  const handleGenerateTechPack = async () => {
    if (!image || !anchorValue) return;
    setStep('generating');
    try {
      const data = await generateTechPack(image.url, anchorName, anchorValue);
      
      let finalImageUrl = image.url;
      if (user) {
         try {
           finalImageUrl = await uploadGarmentImage(image.file, user.uid);
         } catch (uploadErr) {
           console.error("Storage upload failed, falling back to local base64:", uploadErr);
         }
      }

      setStep('done');
      navigate('/pack/draft', { state: { image: finalImageUrl, techPack: data } });
    } catch (e) {
      console.error(e);
      setStep('requestMeasurement'); // Revert on error
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Create Tech Pack</h1>
        <p className="text-gray-400 mt-1 text-lg">Upload a garment mockup to begin AI analysis.</p>
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
                isActive ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' :
                isPast ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                'border-white/10 text-gray-500'
              }`}>
                {isPast ? <CheckCircle2 size={16} /> : <span className="font-bold text-xs">{i + 1}</span>}
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {i < 2 && <ArrowRight size={16} className="text-gray-600" />}
            </div>
          );
        })}
      </div>

      <GlassCard className="p-8">
        {(step === 'upload' || step === 'analyzing') && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white mb-6">Upload Mockup</h2>
            <ImageUpload onImageSelected={handleImageSelected} />
            
            {step === 'analyzing' && (
              <div className="flex flex-col items-center justify-center py-12 animate-in fade-in">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto text-blue-400 animate-pulse" size={20} />
                </div>
                <h3 className="text-xl font-medium mt-6 text-white text-center">AI Vision Analysis</h3>
                <p className="text-gray-400 mt-2 text-center max-w-sm">
                  Scanning garment details, construction features, and silhouette...
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'requestMeasurement' && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
             <div className="flex gap-8">
                <div className="w-1/3 shrink-0">
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 relative">
                    <img src={image?.url} alt="Mockup" className="w-full object-contain aspect-square" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                       <CheckCircle2 size={16} className="text-green-400" />
                       <span className="text-xs font-semibold tracking-wide text-white">ANALYZED</span>
                    </div>
                  </div>
                </div>
                
                <div className="w-2/3 flex flex-col justify-center gap-6">
                   <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-5 relative overflow-hidden">
                     <div className="absolute -right-4 -top-4 text-blue-500/10"><Sparkles size={100} /></div>
                     <h3 className="text-xl font-semibold text-white mb-2 relative z-10">Anchor Measurement Found</h3>
                     <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                       To generate accurate specs for the rest of this garment, the AI needs a starting point. Please provide the 
                       <strong className="text-blue-400 mx-1">{anchorName}</strong> for your base size (e.g. Medium).
                     </p>
                   </div>
                   
                   <div className="space-y-4">
                     <Input 
                       label={`${anchorName} (with units, e.g. 21.5")`}
                       placeholder="Enter measurement..."
                       value={anchorValue}
                       onChange={e => setAnchorValue(e.target.value)}
                       autoFocus
                     />
                   </div>
                   
                   <div className="pt-4 flex justify-end">
                     <Button 
                       onClick={handleGenerateTechPack} 
                       disabled={!anchorValue.trim()} 
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
                <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                <Sparkles className="absolute inset-0 m-auto text-purple-400 animate-pulse" size={28} />
             </div>
             <h3 className="text-2xl font-medium mt-6 text-white text-center">Drafting the Tech Pack</h3>
             <p className="text-gray-400 mt-2 text-center max-w-sm">
               Calculating proportional measurements, calling out construction details, and identifying fabric...
             </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
