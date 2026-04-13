import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Download, Save, ArrowLeft, Wand2, History, Lock, Unlock, X, Scan, QrCode } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import html2canvas from 'html2canvas';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../contexts/AuthContext';
import { saveTechPack, getTechPack, uploadBase64Image } from '../services/dbService';
import { GarmentAnnotator } from '../components/editor/GarmentAnnotator';
import { DetailAnnotator, DetailItem } from '../components/editor/DetailAnnotator';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, deleteDoc, doc, updateDoc } from 'firebase/firestore';
const AutoTextarea = ({ value, onChange, className, placeholder }: { value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, className: string, placeholder?: string }) => {
  return (
    <div className="grid w-full relative">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`resize-none overflow-hidden col-start-1 row-start-1 w-full h-full ${className}`}
        rows={1}
      />
      <div 
        className={`invisible whitespace-pre-wrap col-start-1 row-start-1 w-full break-words pointer-events-none ${className}`} 
        aria-hidden="true"
      >
        {(value || placeholder || '') + ' '}
      </div>
    </div>
  );
};

const RichTextCallouts = ({ value, onChange, className, placeholder }: { value: string, onChange: (v: string) => void, className: string, placeholder?: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
    onChange(e.target.value);
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onBlur={() => setIsEditing(false)}
        className={`${className} bg-white border border-gray-300 focus:border-blue-500 shadow-sm`}
        placeholder={placeholder}
        rows={3}
      />
    );
  }

  const renderRichText = (text: string) => {
    if (!text) return <span className="text-gray-400 italic">{placeholder || "Click to add details..."}</span>;
    return text.split('\n').map((line, i) => {
      const isHeader = /^\d+\.\s/.test(line.trim());
      const isBullet = line.trim().startsWith('-');
      if (isHeader) return <div key={i} className="font-bold text-gray-900 mt-5 mb-2 print:mt-3 print:mb-1 first:mt-0 print:break-after-avoid">{line.trim()}</div>;
      if (isBullet) return <div key={i} className="ml-4 pl-3 relative before:content-[''] before:w-1.5 before:h-1.5 print:before:w-1 print:before:h-1 before:bg-gray-500 before:rounded-full before:absolute before:left-[-3px] before:top-2 print:before:top-1.5 text-gray-700 mb-1 print:break-inside-avoid">{line.replace(/^\s*-\s*/, '')}</div>;
      if (line.trim() === '') return <div key={i} className="h-3 print:h-2"></div>;
      return <div key={i} className="text-gray-700 mb-1 print:break-inside-avoid">{line}</div>;
    });
  };

  return (
    <div 
      onClick={() => setIsEditing(true)}
      className={`${className} cursor-text hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors`}
    >
      {renderRichText(value)}
    </div>
  );
};

const formatName = (email?: string | null) => {
  if (!email) return 'Unknown';
  const namePart = email.split('@')[0];
  return namePart.split(/[\.\-_]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
};

export function TechPackEditor() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const exportRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({ properties: {}, measurements: [], callouts: [], bom: [] });
  const [imageUrl, setImageUrl] = useState('');

  const [packName, setPackName] = useState('Untitled Garment');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'techpack' | 'linesheet'>('techpack');
  const annotatorRef = useRef<HTMLDivElement>(null);

  const MEASUREMENT_UNIT_KEY = 'global_unit_v2';
  const [globalUnit, setGlobalUnit] = useState<'in' | 'cm'>(() => (localStorage.getItem(MEASUREMENT_UNIT_KEY) as 'in' | 'cm') || 'cm');

  const toggleUnit = () => {
    const nextUnit = globalUnit === 'in' ? 'cm' : 'in';
    setGlobalUnit(nextUnit);
    localStorage.setItem(MEASUREMENT_UNIT_KEY, nextUnit);

    // Auto-convert existing measurements
    setData((prev: any) => {
      const newMs = (prev.measurements || []).map((m: any) => ({
        ...m,
        value: autoConvert(m.value, nextUnit),
        tolMinus: autoConvert(m.tolMinus, nextUnit),
        tolPlus: autoConvert(m.tolPlus, nextUnit),
        tolerance: autoConvert(m.tolerance, nextUnit)
      }));
      return { ...prev, measurements: newMs };
    });
  };

  const autoConvert = (str: string | undefined, targetUnit: 'in' | 'cm') => {
    if (!str || !str.trim()) return str;
    const val = str.trim();
    
    // Convert TO cm from IN
    if (targetUnit === 'cm') {
      const dec = parseFractionToDecimal(val);
      if (dec === null) return str;
      return (dec * 2.54).toFixed(2).replace(/\.00$/, '');
    } else {
      // Convert TO IN from CM
      const float = parseFloat(val);
      if (isNaN(float)) return str;
      const dec = float / 2.54;
      return decimalToNearestFractionStr(dec, 8);
    }
  };

  const parseFractionToDecimal = (val: string): number | null => {
    let match = val.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
    if (match) return parseInt(match[1]) + (parseInt(match[2]) / parseInt(match[3]));
    match = val.match(/^(\d+)\/(\d+)$/);
    if (match) return parseInt(match[1]) / parseInt(match[2]);
    const float = parseFloat(val);
    return isNaN(float) ? null : float;
  };

  const decimalToNearestFractionStr = (decimal: number, denominator: number = 8): string => {
    const whole = Math.floor(decimal);
    const fraction = decimal - whole;
    const num = Math.round(fraction * denominator);
    if (num === 0) return whole === 0 ? "0" : whole.toString();
    if (num === denominator) return (whole + 1).toString();
    let n = num, d = denominator;
    while (n % 2 === 0 && d % 2 === 0) { n /= 2; d /= 2; }
    if (whole === 0) return `${n}/${d}`;
    return `${whole} ${n}/${d}`;
  };

  const isCreator = !data?.userId || user?.uid === data?.userId;
  const canEdit = isCreator || (data?.isTeamEditable !== false);

  const toggleTeamEditable = () => {
    if (!isCreator) return;
    const isLocking = data?.isTeamEditable ?? true;
    pushLog(isLocking ? 'Locked Team Editing' : 'Unlocked Team Editing');
    setData((prev: any) => ({ ...prev, isTeamEditable: !isLocking }));
  };

  const pushLog = (message: string) => {
    setData((prev: any) => ({
      ...prev,
      activityLog: [...(prev.activityLog || []), {
        timestamp: new Date().toISOString(),
        message,
        user: user?.email || 'Unknown'
      }]
    }));
  };

  const handleVectorize = async () => {
    setIsVectorizing(true);
    try {
      const { vectorizeGarmentImage } = await import('../services/nanobananaService');
      const newImageUrl = await vectorizeGarmentImage(imageUrl);
      setGalleryImages(prev => {
        const newGallery = [newImageUrl, ...prev];
        setData((d: any) => ({ ...d, gallery: newGallery }));
        return newGallery;
      });
      setImageUrl(newImageUrl);
      pushLog(`Generated Vector Blueprint successfully`);
    } catch (e: any) {
      alert("Nano Banana Vectorization failed: " + e.message);
    } finally {
      setIsVectorizing(false);
    }
  };

  useEffect(() => {
    if (!user || (!id && id !== 'draft')) return;
    const q = query(collection(db, 'companionUploads'));
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const docData = change.doc.data();
          const docId = change.doc.id;
          
          if (docData.imageUrl && docId.startsWith(`${user.uid}_${id}_detail_`)) {
             const mIdxStr = docId.split('_detail_')[1];
             const mIdx = parseInt(mIdxStr, 10);
             if (!isNaN(mIdx)) {
                setData((prev: any) => {
                   const newData = { ...prev };
                   let mods = newData.detailModules;
                   if (!mods) {
                      if (newData.detailImage || newData.details) {
                         mods = [{ title: 'Detail Closeups', subtitle: 'Button & Hardware Details', detailImage: newData.detailImage || '', details: newData.details || [] }];
                      } else {
                         mods = [{ title: 'Detail Closeups', subtitle: 'Button & Hardware Details', detailImage: '', details: [] }];
                      }
                   }
                   
                   mods = [...mods];
                   if (mods[mIdx]) {
                      const curMod = { ...mods[mIdx] };
                      const currentImages = curMod.detailImages?.length ? curMod.detailImages : (curMod.detailImage ? [curMod.detailImage] : []);
                      const newImages = [...currentImages, docData.imageUrl];
                      
                      curMod.detailImages = newImages;
                      curMod.detailImage = newImages[0]; // backward compat
                      mods[mIdx] = curMod;
                   }
                   newData.detailModules = mods;
                   return newData;
                });
                deleteDoc(doc(db, 'companionUploads', docId)).catch(() => {});
             }
          }
        }
      });
    });
    return unsub;
  }, [user, id]);

  useEffect(() => {
    if (location.state?.techPack) {
      setData({
        ...location.state.techPack,
        userId: location.state.userId,
        isTeamEditable: location.state.isTeamEditable,
        activityLog: location.state.activityLog
      });
      const initialImage = location.state.techPack?.images?.original || location.state.image || '';
      setImageUrl(initialImage);
      

      const initialGallery = location.state.techPack?.gallery || [];
      if (initialImage && !initialGallery.includes(initialImage)) {
         initialGallery.unshift(initialImage);
      }
      setGalleryImages(initialGallery);

      if (location.state.name) setPackName(location.state.name);
      setIsLoading(false);
    } else if (id && id !== 'draft') {
      getTechPack(id).then((packInfo) => {
        if (packInfo) {
          setData({
            ...packInfo.techPack,
            userId: packInfo.userId,
            isTeamEditable: packInfo.isTeamEditable,
            activityLog: packInfo.activityLog
          });
          const initialImage = packInfo.techPack?.images?.original || packInfo.imageUrl;
          setImageUrl(initialImage);
          

          const initialGallery = packInfo.techPack?.gallery || [];
          if (initialImage && !initialGallery.includes(initialImage)) {
             initialGallery.unshift(initialImage);
          }
          setGalleryImages(initialGallery);

          setPackName(packInfo.name);
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [id, location.state]);

  const handleSave = async () => {
    if (!user) return alert("Must be logged in to save.");
    setIsSaving(true);
    try {
      const saveLog = {
        timestamp: new Date().toISOString(),
        message: 'Saved Tech Pack',
        user: user.email || 'Unknown'
      };
      const finalActivityLog = [...(data.activityLog || []), saveLog];
      setData((prev: any) => ({ ...prev, activityLog: finalActivityLog }));

      let annotatedImg = '';
      if (annotatorRef.current) {
        const canvas = await html2canvas(annotatorRef.current, { useCORS: true, scale: 2, logging: false });
        annotatedImg = canvas.toDataURL('image/png');
      }

      let finalAnnotatedUrl = '';
      if (annotatedImg.startsWith('data:')) {
        finalAnnotatedUrl = await uploadBase64Image(annotatedImg, user.uid);
      }

      const techPackDataToSave = { ...data };

      let finalGalleryImages = [];
      for (const gImg of galleryImages) {
         let finalUrl = gImg;
         if (gImg.startsWith('data:')) {
            finalUrl = await uploadBase64Image(gImg, user.uid);
         }
         finalGalleryImages.push(finalUrl);
      }
      setGalleryImages(finalGalleryImages);
      techPackDataToSave.gallery = finalGalleryImages;

      if (techPackDataToSave.patternImage?.startsWith('data:')) {
        techPackDataToSave.patternImage = await uploadBase64Image(techPackDataToSave.patternImage, user.uid);
      }
      if (techPackDataToSave.lineSheetImage?.startsWith('data:')) {
        techPackDataToSave.lineSheetImage = await uploadBase64Image(techPackDataToSave.lineSheetImage, user.uid);
      }
      if (techPackDataToSave.detailModules?.length) {
        for (let i = 0; i < techPackDataToSave.detailModules.length; i++) {
          if (techPackDataToSave.detailModules[i].detailImage?.startsWith('data:')) {
            techPackDataToSave.detailModules[i].detailImage = await uploadBase64Image(techPackDataToSave.detailModules[i].detailImage, user.uid);
          }
        }
      } else if (techPackDataToSave.detailImage?.startsWith('data:')) {
        techPackDataToSave.detailImage = await uploadBase64Image(techPackDataToSave.detailImage, user.uid);
      }
      if (!techPackDataToSave.images) techPackDataToSave.images = {};
      techPackDataToSave.images.original = techPackDataToSave.images.original || imageUrl;
      techPackDataToSave.images.annotated = finalAnnotatedUrl;

      // Strip root properties that were temporarily injected for the editor UI logic to avoid Firebase undefined nesting errors
      delete techPackDataToSave.userId;
      delete techPackDataToSave.isTeamEditable;
      delete techPackDataToSave.activityLog;

      const existingId = id === 'draft' ? undefined : id;
      const savedId = await saveTechPack(
        user.uid, 
        profile?.companyId || user.uid, 
        packName, 
        finalGalleryImages[0] || imageUrl, 
        techPackDataToSave, 
        user.email || 'Unknown',
        existingId,
        finalActivityLog,
        data.isTeamEditable ?? true
      );
      if (id === 'draft') {
        navigate(`/pack/${savedId}`, { replace: true, state: { techPack: techPackDataToSave, image: imageUrl, name: packName } });
      }
    } catch (e: any) {
      console.error(e);
      alert("Failed to save tech pack: \n\n" + (e.message || String(e)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = useReactToPrint({
    contentRef: exportRef,
    documentTitle: `${packName.replace(/\s+/g, '_')}_${viewMode === 'linesheet' ? 'LineSheet' : 'TechPack'}`,
    pageStyle: `
      @page {
        size: ${viewMode === 'linesheet' ? 'portrait' : 'landscape'};
        margin: 0.5in;
      }
      @media print {
        body { 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact; 
        }
        .print-container {
           width: 100% !important;
           max-width: none !important;
           padding: 0 !important;
        }
        
        .print-image-wrapper {
           page-break-inside: avoid;
           break-inside: avoid;
           overflow: hidden !important;
        }

        .print-image-wrapper > div {
           aspect-ratio: auto !important;
           height: 4.5in !important;
           margin: 0 auto;
           overflow: hidden;
        }
        
        .print-properties-grid {
           display: grid !important;
           grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        }
        
        /* Ensure tables stay within width */
        table {
           width: 100% !important;
           table-layout: fixed;
           word-wrap: break-word;
        }
        th, td {
           white-space: normal !important;
           word-break: break-word;
        }
        
        /* Ensure headers stay attached to the content below them */
        h1, h2, h3, h4, h5, h6, .print-header-avoid {
           page-break-after: avoid !important;
           break-after: avoid !important;
           page-break-inside: avoid !important;
        }
        
        /* Force page breaks properly where we told it to */
        .page-break-avoid {
           page-break-inside: avoid;
           break-inside: avoid;
        }
        
        /* Force explicit new pages per section */
        .print-force-new-page {
           page-break-before: always !important;
           break-before: page !important;
           margin-top: 0 !important;
        }
        
        textarea {
           resize: none;
           overflow: hidden;
           border: none;
        }
      }
    `
  });

  const updateMeasurement = (index: number, field: string, value: string) => {
    const newData = { ...data };
    newData.measurements[index][field] = value;
    setData(newData);
  };

  const ensureDetailModules = () => {
    let mods = data.detailModules;
    if (!mods) {
      if (data.detailImage || (data.details && data.details.length > 0)) {
        mods = [{
          title: 'Detail Closeups',
          subtitle: 'Button & Hardware Details',
          detailImage: data.detailImage || '',
          details: data.details || []
        }];
      } else {
        mods = [];
      }
    }
    return mods;
  };

  const dModules = ensureDetailModules();

  const updateDetailModuleStr = (modIndex: number, field: string, value: string) => {
    const newData = { ...data };
    if (!newData.detailModules) newData.detailModules = ensureDetailModules();
    newData.detailModules[modIndex][field] = value;
    setData(newData);
  };

  const updateDetailDesc = (modIndex: number, index: number, description: string) => {
    const newData = { ...data };
    if (!newData.detailModules) newData.detailModules = ensureDetailModules();
    newData.detailModules[modIndex].details[index].description = description;
    setData(newData);
  };

  const updateDetailObj = (modIndex: number, index: number, detailObj: DetailItem) => {
    const newData = { ...data };
    if (!newData.detailModules) newData.detailModules = ensureDetailModules();
    newData.detailModules[modIndex].details[index] = detailObj;
    setData(newData);
  };

  const addDetailToMod = (modIndex: number) => {
    const newData = { ...data };
    if (!newData.detailModules) newData.detailModules = ensureDetailModules();
    const details = newData.detailModules[modIndex].details || [];
    details.push({ id: (details.length + 1).toString(), description: '', position: null });
    newData.detailModules[modIndex].details = details;
    setData(newData);
  };

  const removeDetail = (modIndex: number, index: number) => {
    const newData = { ...data };
    if (!newData.detailModules) newData.detailModules = ensureDetailModules();
    newData.detailModules[modIndex].details.splice(index, 1);
    newData.detailModules[modIndex].details.forEach((d: any, i: number) => { d.id = (i + 1).toString(); });
    setData(newData);
  };

  const addDetailModule = () => {
    const newData = { ...data };
    if (!newData.detailModules) newData.detailModules = ensureDetailModules();
    newData.detailModules.push({ title: 'Detail Closeups', subtitle: 'Button & Hardware Details', detailImage: '', details: [] });
    setData(newData);
  };

  const updateBOM = (index: number, field: string, value: string) => {
    const newData = { ...data };
    if (!newData.bom) newData.bom = [];
    newData.bom[index][field] = value;
    setData(newData);
  };

  const updateConstruction = (val: string) => {
    const newData = { ...data };
    newData.callouts = val;
    setData(newData);
  };

  const updateProperty = (field: string, value: string) => {
    const newData = { ...data };
    if (!newData.properties) newData.properties = {};
    newData.properties[field] = value;
    setData(newData);
  };

  if (isLoading) return <div className="py-20 text-center text-gray-500">Loading...</div>;

  if (!data?.measurements?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500 mb-4">No Tech Pack data found.</p>
        <Button onClick={() => navigate('/create')}>Create New Tech Pack</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1300px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <input 
            value={packName} 
            onChange={(e) => setPackName(e.target.value)} 
            className="text-4xl font-serif font-bold tracking-tight text-gray-900 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-black outline-none transition-all px-1" 
            placeholder="Garment Name"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-xl mr-2 print:hidden hidden sm:flex shrink-0">
             <button onClick={() => setViewMode('techpack')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'techpack' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Tech Pack</button>
             <button onClick={() => setViewMode('linesheet')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'linesheet' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Line Sheet</button>
          </div>
          {isCreator && (
            <Button 
               onClick={toggleTeamEditable} 
               variant="secondary" 
               className={`w-9 h-9 p-0 flex items-center justify-center shrink-0 ${data?.isTeamEditable === false ? 'text-red-600 bg-red-50 border-red-200' : 'text-gray-600'}`}
               title={data?.isTeamEditable === false ? "Team editing locked" : "Team editing unlocked"}
            >
               {data?.isTeamEditable === false ? <Lock size={16} /> : <Unlock size={16} />}
            </Button>
          )}
          {!canEdit && (
            <div className="bg-orange-50 border border-orange-200 text-orange-600 px-3 h-9 rounded-xl text-xs font-bold flex items-center gap-2 hidden sm:flex shrink-0">
               <Lock size={14} /> View Only
            </div>
          )}
          {canEdit && (
            <Button onClick={handleSave} isLoading={isSaving} variant="secondary" className="px-3 md:px-4 h-9 shrink-0">
              <div className="flex items-center gap-2 text-sm">
                <Save size={16} />
                <span className="hidden sm:inline font-semibold">Save</span>
              </div>
            </Button>
          )}
          <Button onClick={() => setShowHistory(true)} variant="secondary" className="w-9 h-9 p-0 flex items-center justify-center shrink-0" title="Activity Log">
             <History size={16} />
          </Button>
          <Button onClick={() => { pushLog(`Exported ${viewMode === 'linesheet' ? 'Line Sheet' : 'Tech Pack'} to PDF`); handleExport(); }} className="px-3 md:px-4 h-9 shadow-md shrink-0 bg-black text-white hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-2 text-sm">
              <Download size={16} />
              <span className="hidden sm:inline font-semibold">Export</span>
            </div>
          </Button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm relative">
        {/* Export Container */}
        <div ref={exportRef} className="p-10 w-full bg-white text-gray-900 print-container">
          
          <header className="border-b border-gray-200 pb-2 mb-2 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-serif font-extrabold tracking-tight leading-none uppercase">
                 {packName ? `${packName} - ` : ''}{viewMode === 'linesheet' ? 'LINE SHEET' : 'TECH PACK'}
              </h1>
              <div className="text-gray-500 font-sans font-medium tracking-widest text-[11px] uppercase mt-1">{viewMode === 'linesheet' ? 'WHOLESALE SUMMARY' : 'GARMENT SPECIFICATION'}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs print:text-[10px]">Date: {new Date().toLocaleDateString()}</div>
              <div className="text-gray-500 text-xs print:text-[10px] mt-0.5">Ref: {data?.properties?.style || `TP-${Math.floor(Math.random() * 10000)}`}</div>
            </div>
          </header>

          {/* Properties Section */}
          <div className="print-properties-grid grid grid-cols-2 md:grid-cols-5 gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 mb-4">
             <div className="space-y-0.5">
               <div className="text-xs print:text-[10px] uppercase font-bold text-gray-400 leading-none">Style Number</div>
               <input 
                 className="w-full text-sm print:text-xs font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none transition-colors"
                 value={data?.properties?.style || ''}
                 placeholder="N/A"
                 onChange={(e) => updateProperty('style', e.target.value)}
               />
             </div>
             <div className="space-y-0.5">
               <div className="text-xs print:text-[10px] uppercase font-bold text-gray-400 leading-none">Season</div>
               <input 
                 className="w-full text-sm print:text-xs font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none transition-colors"
                 value={data?.properties?.season || ''}
                 placeholder="N/A"
                 onChange={(e) => updateProperty('season', e.target.value)}
               />
             </div>
             <div className="space-y-0.5">
               <div className="text-xs print:text-[10px] uppercase font-bold text-gray-400 leading-none">Category</div>
               <input 
                 className="w-full text-sm print:text-xs font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none transition-colors"
                 value={data?.properties?.category || ''}
                 placeholder="N/A"
                 onChange={(e) => updateProperty('category', e.target.value)}
               />
             </div>
             <div className="space-y-0.5">
               <div className="text-xs print:text-[10px] uppercase font-bold text-gray-400 leading-none">Designer</div>
               <input 
                 className="w-full text-sm print:text-xs font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none transition-colors"
                 value={data?.properties?.designer || ''}
                 placeholder="N/A"
                 onChange={(e) => updateProperty('designer', e.target.value)}
               />
             </div>
             <div className="space-y-0.5">
               <div className="text-xs print:text-[10px] uppercase font-bold text-gray-400 leading-none">Gender</div>
               <input 
                 className="w-full text-sm print:text-xs font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none transition-colors"
                 value={data?.properties?.gender || ''}
                 placeholder="N/A"
                 onChange={(e) => updateProperty('gender', e.target.value)}
               />
             </div>
          </div>

          {viewMode === 'techpack' ? (
            <>
              <div className="grid grid-cols-12 gap-4 print:flex print:flex-col">
            {/* Left Column: Image & Callouts */}
            <div className="col-span-5 print:w-full print:mb-8 space-y-4">
              {imageUrl ? (
                <div>
                  <div className={`bg-white rounded-2xl print-image-wrapper`}>
                    {/* Interactive UI and Annotated Print */}
                    <div ref={annotatorRef} className="w-full h-full flex flex-col">
                      <GarmentAnnotator 
                        imageUrl={imageUrl} 
                        measurements={data.measurements}
                        onVectorize={handleVectorize}
                        isVectorizing={isVectorizing}
                      />
                      <div className="hidden print:block text-center text-[10px] uppercase font-bold text-gray-500 mt-2 shrink-0">Garment Detail</div>
                    </div>
                  </div>

                  {/* Photo Gallery Strip */}
                  <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2 print:hidden scrollbar-hide py-1">
                     {galleryImages.map((gImg, idx) => (
                       <div 
                          key={idx} 
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', idx.toString());
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                            if (isNaN(fromIdx) || fromIdx === idx) return;
                            const newGallery = [...galleryImages];
                            const [moved] = newGallery.splice(fromIdx, 1);
                            newGallery.splice(idx, 0, moved);
                            setGalleryImages(newGallery);
                            
                            // Reorder finalGalleryImages in dataset as well so saving reflects rearranging
                            setData((d: any) => ({ ...d, gallery: newGallery }));
                            
                            if (idx === 0) setImageUrl(moved);
                            
                            // Immediately auto-save the new main thumbnail choice if the file is already in the database
                            if (idx === 0 && id && id !== 'draft' && !moved.startsWith('data:')) {
                               try {
                                 await updateDoc(doc(db, 'techPacks', id), {
                                    imageUrl: moved,
                                    "techPack.gallery": newGallery
                                 });
                               } catch (err) {
                                 console.error("Auto-sync image error:", err);
                               }
                            }
                          }}

                          className={`group relative w-[60px] h-[60px] sm:w-16 sm:h-16 rounded-lg shrink-0 cursor-move overflow-hidden border-2 transition-all ${imageUrl === gImg ? 'border-black scale-105 shadow-md z-10' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                          onClick={() => setImageUrl(gImg)}
                       >
                          <img src={gImg} className="w-full h-full object-cover pointer-events-none" alt="Gallery thumbnail" />
                          {idx === 0 && (
                              <div className="absolute top-0 left-0 bg-black text-white text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg shadow-sm">MAIN</div>
                           )}
                            {idx !== 0 && (
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newGallery = [...galleryImages];
                                  const [moved] = newGallery.splice(idx, 1);
                                  newGallery.unshift(moved);
                                  setGalleryImages(newGallery);
                                  setData((d: any) => ({ ...d, gallery: newGallery }));
                                  setImageUrl(moved);
                                  
                                  // Immediately auto-save the new main thumbnail choice if the file is already in the database
                                  if (id && id !== 'draft' && !moved.startsWith('data:')) {
                                     try {
                                       await updateDoc(doc(db, 'techPacks', id), {
                                          imageUrl: moved,
                                          "techPack.gallery": newGallery
                                       });
                                     } catch (err) {
                                       console.error("Auto-sync image error:", err);
                                     }
                                  }
                                }}
                                className="absolute top-0.5 right-0.5 bg-white/90 hover:bg-black hover:text-white text-gray-400 text-[10px] w-5 h-5 flex flex-col items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 transition-all font-bold shadow-sm"
                                title="Set as Main Cover Photo"
                              >
                                ★
                              </button>
                           )}
                       </div>
                     ))}
                     <label className="w-[60px] h-[60px] sm:w-16 sm:h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center shrink-0 cursor-pointer hover:bg-gray-50 hover:border-gray-400 group">
                        <span className="text-gray-400 group-hover:text-black font-bold text-xl leading-none transition-colors">+</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={async (e) => {
                           if (e.target.files) {
                              const files = Array.from(e.target.files);
                              const promises = files.map(file => new Promise<string>((res) => {
                                 const r = new FileReader(); r.onload = (ev) => res(ev.target?.result as string); r.readAsDataURL(file);
                              }));
                              const newImages = await Promise.all(promises);
                              const newGallery = [...galleryImages, ...newImages];
                              setGalleryImages(newGallery);
                              if (!imageUrl && newImages.length > 0) setImageUrl(newImages[0]);
                           }
                        }} />
                     </label>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-8 aspect-[4/5] w-full">
                  <label className="cursor-pointer group flex flex-col items-center gap-4">
                     <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center group-hover:shadow-md transition-all text-gray-400 group-hover:text-black">
                        <span className="text-2xl leading-none font-bold">+</span>
                     </div>
                     <span className="text-sm font-bold text-gray-500 group-hover:text-black">Upload Garment Photo</span>
                     <input type="file" multiple accept="image/*" className="hidden" onChange={async (e) => {
                         if (e.target.files && e.target.files.length > 0) {
                            const files = Array.from(e.target.files);
                            const promises = files.map(file => new Promise<string>((res) => {
                               const r = new FileReader(); r.onload = (ev) => res(ev.target?.result as string); r.readAsDataURL(file);
                            }));
                            const newImages = await Promise.all(promises);
                            setGalleryImages(newImages);
                            setImageUrl(newImages[0]);
                         }
                      }} />
                  </label>
                </div>
              )}

              {isCreator && (
                <div className="print-force-new-page">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-2 print-header-avoid">
                    <h3 className="text-lg font-serif font-bold text-gray-900 leading-tight">Construction Details</h3>
                  </div>
                  <div className="text-xs print:text-[10px] text-gray-700 w-full block">
                    <RichTextCallouts 
                      className="w-full bg-transparent outline-none leading-relaxed min-h-[150px] print:columns-2 print:gap-14"
                      value={
                        typeof data.callouts === 'string' 
                          ? data.callouts 
                          : (Array.isArray(data.callouts) && data.callouts.length > 0)
                            ? data.callouts.map((c: any, i: number) => `${i + 1}. ${c.description || ''}`).join('\n')
                            : ''
                      }
                      onChange={(val: string) => updateConstruction(val)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Measurements & Fabrication */}
            <div className="col-span-7 print:w-full space-y-4">
              {/* Measurements Table */}
              <div className="print-force-new-page">
                <h3 className="text-lg font-serif font-bold border-b border-gray-200 pb-1 mb-2 text-gray-900 flex items-center justify-between leading-tight">
                  <span>Measurements <span className="text-sm font-sans tracking-wide text-gray-400 font-normal">({globalUnit === 'in' ? 'inches' : 'cm'})</span></span>
                  <button onClick={toggleUnit} className="print:hidden text-[10px] font-sans font-bold bg-gray-100 border border-gray-200 hover:border-gray-300 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all shadow-sm">
                    Convert to {globalUnit === 'in' ? 'Centimeters' : 'Inches'}
                  </button>
                </h3>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-xs print:text-[10px] text-left">
                    <thead className="text-xs print:text-[10px] text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-2 py-1 font-medium w-24">DIM (ID)</th>
                        <th className="px-2 py-1 font-medium">Point of Measure</th>
                        <th className="px-2 py-1 font-medium w-20">Spec</th>
                        <th className="px-1 py-1 font-medium w-12 text-center">Tol (-)</th>
                        <th className="px-1 py-1 font-medium w-12 text-center">Tol (+)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.measurements.map((m: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors" style={{ pageBreakInside: 'avoid' }}>
                          <td className="px-2 py-2 align-top font-mono text-xs print:text-[10px] text-gray-500">
                             <AutoTextarea className="w-full bg-transparent outline-none uppercase leading-tight" value={m.id || ''} onChange={e => updateMeasurement(i, 'id', e.target.value)} />
                          </td>
                          <td className="px-2 py-2 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none font-semibold text-gray-900 leading-tight" value={m.point || ''} onChange={e => updateMeasurement(i, 'point', e.target.value)} />
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-500 text-xs print:text-[10px] leading-tight" value={m.description || ''} onChange={e => updateMeasurement(i, 'description', e.target.value)} />
                          </td>
                          <td className="px-2 py-2 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-900 font-mono font-bold leading-tight" value={m.value || ''} onChange={e => updateMeasurement(i, 'value', e.target.value)} />
                          </td>
                          <td className="px-1 py-2 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-red-500 font-mono text-xs print:text-[10px] text-center leading-none" value={m.tolMinus || m.tolerance || ''} onChange={e => updateMeasurement(i, 'tolMinus', e.target.value)} />
                          </td>
                          <td className="px-1 py-2 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-green-600 font-mono text-xs print:text-[10px] text-center leading-none" value={m.tolPlus || m.tolerance || ''} onChange={e => updateMeasurement(i, 'tolPlus', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Style BOM (Bill of Materials) Table */}
              <div className="print-force-new-page">
                <h3 className="text-lg font-serif font-bold border-b border-gray-200 pb-1 mb-2 text-gray-900 leading-tight">Style BOM (Bill of Materials)</h3>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-xs print:text-[10px] text-left">
                    <thead className="text-xs print:text-[10px] text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-2 py-1 font-medium w-28">Category</th>
                        <th className="px-2 py-1 font-medium">Component</th>
                        <th className="px-2 py-1 font-medium">Positioning</th>
                        <th className="px-2 py-1 font-medium">Comment</th>
                        <th className="px-2 py-1 font-medium">Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.bom || data.fabrication || []).map((f: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors" style={{ pageBreakInside: 'avoid' }}>
                          <td className="px-2 py-2 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none font-semibold text-gray-900 uppercase text-xs print:text-[10px] tracking-wider leading-tight" value={f.category || 'FABRIC'} onChange={e => updateBOM(i, 'category', e.target.value)} />
                          </td>
                          <td className="px-2 py-2 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-900 font-semibold leading-tight" value={f.component || f.material || ''} onChange={e => updateBOM(i, 'component', e.target.value)} />
                          </td>
                          <td className="px-2 py-2 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-600 leading-tight" value={f.positioning || f.placement || ''} onChange={e => updateBOM(i, 'positioning', e.target.value)} />
                          </td>
                          <td className="px-2 py-2 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-600 leading-tight" value={f.comment || f.notes || ''} onChange={e => updateBOM(i, 'comment', e.target.value)} />
                          </td>
                          <td className="px-2 py-2 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-500 text-xs print:text-[10px] leading-tight" value={f.supplier || ''} onChange={e => updateBOM(i, 'supplier', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>


          {/* Detail Closeups Section */}
          {dModules.map((mod: any, mIdx: number) => (
            <div key={mIdx} className="print-force-new-page pt-4 mt-8 print:mt-0 print:pt-0 group/mod">
              <div className="border-b border-gray-200 pb-1 mb-4 flex items-center justify-between">
                <input 
                  value={mod.title || ''} 
                  onChange={(e) => updateDetailModuleStr(mIdx, 'title', e.target.value)} 
                  className="w-full text-lg font-serif font-bold text-gray-900 leading-tight bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none transition-colors"
                  placeholder="Detail Closeups"
                />
                {mIdx > 0 && (
                   <button onClick={() => {
                      const newData = { ...data };
                      newData.detailModules.splice(mIdx, 1);
                      setData(newData);
                   }} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase print:hidden shrink-0 ml-4 opacity-0 group-hover/mod:opacity-100 transition-opacity"><X size={16} /></button>
                )}
              </div>
              <div className="grid grid-cols-12 gap-6 bg-white border border-gray-200 rounded-2xl p-6 print:border-none print:p-0">
                 <div className="col-span-12 md:col-span-7 print:col-span-8 space-y-4">
                     {(() => {
                        const images = mod.detailImages?.length ? mod.detailImages : (mod.detailImage ? [mod.detailImage] : []);
                        
                        return images.length > 0 ? (
                          <div className="relative group w-full flex flex-col">
                             <DetailAnnotator 
                               images={images} 
                               details={mod.details || []}
                               onUpdateDetail={(i, d) => updateDetailObj(mIdx, i, d)}
                               onRemoveImage={(imgIdx) => {
                                  const newImages = [...images];
                                  newImages.splice(imgIdx, 1);
                                  const newData = { ...data };
                                  newData.detailModules[mIdx].detailImages = newImages;
                                  newData.detailModules[mIdx].detailImage = newImages[0] || '';
                                  setData(newData);
                               }}
                               onAddImageClick={() => document.getElementById(`hidden-detail-upload-${mIdx}`)?.click()}
                               qrTriggerNode={user && (id || id === 'draft') ? (
                                  <button onClick={() => setQrModalUrl(`${window.location.origin}/detail-camera/${user.uid}_${id}_detail_${mIdx}`)} className="group relative w-14 h-14 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col gap-1 items-center justify-center shrink-0 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer">
                                     <QrCode className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" />
                                     <span className="text-[8px] font-bold text-gray-500 group-hover:text-black">CONNECT</span>
                                  </button>
                               ) : null}
                             />
                             <input type="file" id={`hidden-detail-upload-${mIdx}`} className="hidden" accept="image/*" multiple onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                   Array.from(e.target.files).forEach(file => {
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                         setData((prev: any) => {
                                            const newData = { ...prev };
                                            const newImages = [...(newData.detailModules[mIdx].detailImages || []), ev.target?.result as string];
                                            newData.detailModules[mIdx].detailImages = newImages;
                                            newData.detailModules[mIdx].detailImage = newImages[0];
                                            return newData;
                                         });
                                      };
                                      reader.readAsDataURL(file);
                                   });
                                }
                             }} />
                          </div>
                        ) : (
                          <div className="flex w-full aspect-[4/3] gap-4 print:hidden">
                            <label className="flex-1 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors p-4 text-center">
                              <div className="text-gray-400 text-xs font-semibold flex flex-col items-center gap-2">
                                 <span className="text-2xl leading-none">+</span>
                                 <span>Upload Detail Closeup Photo</span>
                              </div>
                              <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => {
                                 if (e.target.files && e.target.files.length > 0) {
                                    Array.from(e.target.files).forEach(file => {
                                       const reader = new FileReader();
                                       reader.onload = (ev) => {
                                          setData((prev: any) => {
                                             const newData = { ...prev };
                                             const currentImages = newData.detailModules[mIdx].detailImages || (newData.detailModules[mIdx].detailImage ? [newData.detailModules[mIdx].detailImage] : []);
                                             const newImages = [...currentImages, ev.target?.result as string];
                                             newData.detailModules[mIdx].detailImages = newImages;
                                             newData.detailModules[mIdx].detailImage = newImages[0];
                                             return newData;
                                          });
                                       };
                                       reader.readAsDataURL(file);
                                    });
                                 }
                              }} />
                            </label>
    
                            {user && (id || id === 'draft') && (
                              <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-default group hover:border-gray-300 transition-colors">
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-4 group-hover:scale-105 transition-transform duration-300">
                                  <QRCodeSVG 
                                     value={`${window.location.origin}/detail-camera/${user.uid}_${id}_detail_${mIdx}`} 
                                     size={140} 
                                     level={"H"}
                                     fgColor={"#000000"}
                                     includeMargin={false}
                                  />
                                </div>
                                <span className="text-gray-500 text-sm font-bold">Scan to open camera</span>
                              </div>
                            )}
                          </div>
                        );
                     })()}
                 </div>
                 <div className="col-span-12 md:col-span-5 print:col-span-4 space-y-4 md:border-l border-gray-100 md:pl-6 print:border-l-2 print:border-gray-800 print:pl-4 print:space-y-3">
                    <div className="flex items-center justify-between mb-2">
                       <input 
                         value={mod.subtitle || ''} 
                         onChange={e => updateDetailModuleStr(mIdx, 'subtitle', e.target.value)} 
                         className="flex-1 w-full text-xs print:text-[10px] uppercase font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none transition-colors"
                         placeholder="Button & Hardware Details"
                       />
                       <Button 
                         size="sm" 
                         variant="secondary"
                         className="text-[10px] py-1 h-auto print:hidden shrink-0 ml-2"
                         onClick={() => addDetailToMod(mIdx)}
                       >
                         + Add Detail
                       </Button>
                    </div>

                    <div className="space-y-3">
                      {(mod.details || []).map((detail: any, index: number) => (
                        <div key={index} className="flex gap-3 group">
                           <div className="w-6 h-6 shrink-0 bg-gray-100 text-gray-900 rounded-full flex items-center justify-center text-xs font-bold border border-gray-200">
                             {detail.id}
                           </div>
                           <div className="flex-1 relative">
                              <RichTextCallouts
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs print:text-[10px] hover:border-gray-300 focus:border-blue-500 outline-none transition-colors min-h-[40px] block" 
                                placeholder="Add multi-line bullet details here..."
                                value={detail.description || ''} 
                                onChange={val => updateDetailDesc(mIdx, index, val)} 
                              /> 
                              <button 
                                onClick={() => removeDetail(mIdx, index)} 
                                className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                              >
                                <X size={14} />
                              </button>
                           </div>
                        </div>
                      ))}
                      {!(mod.details?.length > 0) && (
                        <div className="text-xs text-gray-400 italic print:hidden">No details added yet. Click "+ Add Detail" to begin.</div>
                      )}
                    </div>
                 </div>
              </div>
            </div>
          ))}
          <div className="flex justify-center mt-6 print:hidden">
              <Button onClick={addDetailModule} variant="secondary" className="border-dashed border-2 bg-gray-50 hover:bg-gray-100 text-gray-600 print:hidden hidden max-[1023px]:inline-flex lg:inline-flex mx-auto">
                  {dModules.length === 0 ? "+ Add Detail Section" : "+ Add Another Detail Section"}
              </Button>
          </div>
          </>
          ) : (
          <>
          {/* Wholesale Line Sheet Section */}
          <div className="pt-2 mt-2 animate-in fade-in duration-300">
             <div className="w-[8.5in] max-w-full mx-auto bg-white border border-gray-200 rounded-3xl p-10 print:border-none print:p-0 print:w-full print:max-w-none shadow-sm print:shadow-none min-h-[9.5in] flex flex-col justify-between">
               
               <div className="flex-1">
                  {/* Header */}
                  <header className="grid grid-cols-3 items-start mb-8 print:mb-8">
                     <div className="flex flex-col text-left">
                       <input className="text-2xl print:text-[22px] font-serif uppercase leading-none mb-1 text-gray-900 bg-transparent outline-none max-w-xs transition-colors hover:border-gray-200 border-b border-transparent focus:border-black" value={data?.properties?.season || ''} onChange={e => updateProperty('season', e.target.value)} placeholder="COLLECTION NAME" />
                       <input className="text-xs print:text-[10px] uppercase font-bold text-gray-500 tracking-wider bg-transparent outline-none max-w-xs transition-colors hover:border-gray-200 border-b border-transparent focus:border-black" value={data?.properties?.category || ''} onChange={e => updateProperty('category', e.target.value)} placeholder="SUBTITLE - PAGE NO" />
                     </div>
                     <div className="flex flex-col items-center justify-center -mt-2 group relative">
                       {data?.properties?.wovnLogo ? (
                         <img src={data.properties.wovnLogo} alt="WOVN Logo" className="h-20 print:h-16 object-contain" />
                       ) : (
                         <>
                           <div className="text-5xl font-serif tracking-widest font-black text-black">WOV/N</div>
                           <div className="text-xs print:text-[9px] tracking-[0.4em] font-medium text-gray-500 mt-1 uppercase">Design Studio</div>
                         </>
                       )}
                       <label className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity print:hidden rounded-lg">
                         <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 px-3 py-1.5 rounded-full text-gray-700 shadow-sm border border-gray-200">Upload WOVN Logo</span>
                         <input type="file" className="hidden" accept="image/*" onChange={e => {
                             if(e.target.files && e.target.files[0]) {
                                const reader = new FileReader();
                                reader.onload = ev => updateProperty('wovnLogo', ev.target?.result as string);
                                reader.readAsDataURL(e.target.files[0]);
                             }
                         }} />
                       </label>
                       {data?.properties?.wovnLogo && (
                         <button onClick={(e) => { e.preventDefault(); updateProperty('wovnLogo', ''); }} className="absolute -top-2 -right-6 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 print:hidden z-10 p-1 bg-white rounded-full shadow-sm"><X size={14}/></button>
                       )}
                     </div>
                     <div className="flex justify-end group relative">
                       {data?.properties?.clientLogo ? (
                         <img src={data.properties.clientLogo} alt="Client Logo" className="w-20 h-20 print:w-16 print:h-16 object-contain" />
                       ) : (
                         <div className="w-14 h-14 bg-black flex items-center justify-center rounded-sm">
                            <span className="text-white font-serif italic text-sm">Client</span>
                         </div>
                       )}
                       <label className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity print:hidden rounded-sm">
                         <span className="text-[10px] font-bold text-center bg-gray-100 px-3 py-1.5 rounded-full text-gray-700 shadow-sm border border-gray-200 uppercase tracking-wider">Upload</span>
                         <input type="file" className="hidden" accept="image/*" onChange={e => {
                             if(e.target.files && e.target.files[0]) {
                                const reader = new FileReader();
                                reader.onload = ev => updateProperty('clientLogo', ev.target?.result as string);
                                reader.readAsDataURL(e.target.files[0]);
                             }
                         }} />
                       </label>
                       {data?.properties?.clientLogo && (
                         <button onClick={(e) => { e.preventDefault(); updateProperty('clientLogo', ''); }} className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 print:hidden z-10 p-1 bg-white rounded-full shadow-sm"><X size={14}/></button>
                       )}
                     </div>
                  </header>

                  {/* Image */}
                  <div className="w-full flex justify-center mb-8 relative group">
                     {data?.lineSheetImage ? (
                       <img src={data.lineSheetImage} className="w-[85%] max-w-[550px] aspect-[4/5] object-contain mix-blend-multiply" />
                     ) : (
                       <div className="w-[85%] max-w-[550px] aspect-[4/5] bg-gray-50 flex items-center justify-center border border-dashed border-gray-200 rounded-2xl">
                         <span className="text-gray-400 font-bold">Upload Garment Render</span>
                       </div>
                     )}
                     {/* upload actions */}
                     <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                        <label className="cursor-pointer bg-white px-3 py-2 rounded-lg shadow border border-gray-200 text-xs font-bold hover:bg-gray-50 text-gray-700">
                          Upload Photo
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                             if (e.target.files && e.target.files[0]) {
                                const reader = new FileReader();
                                reader.onload = (ev) => setData({...data, lineSheetImage: ev.target?.result as string});
                                reader.readAsDataURL(e.target.files[0]);
                             }
                          }} />
                        </label>

                        {data?.lineSheetImage && (
                          <button onClick={() => setData({...data, lineSheetImage: ''})} className="bg-white px-3 py-2 rounded-lg shadow border border-gray-200 text-xs font-bold hover:bg-red-50 text-red-600">
                            Clear
                          </button>
                        )}
                     </div>
                  </div>

                  {/* Title */}
                  <div className="text-center mb-10">
                     <AutoTextarea className="text-[40px] print:text-[36px] font-serif text-gray-900 bg-transparent outline-none text-center w-full max-w-xl mx-auto hover:bg-gray-50 transition-colors rounded-xl" value={packName} onChange={e => setPackName(e.target.value)} placeholder="Product Name" />
                  </div>

                  {/* One properties row block */}
                  <div className="border-t border-gray-200 pt-5">
                     <div className="flex flex-wrap items-start justify-between gap-4 w-full px-2">
                       <div className="space-y-1">
                          <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">SIZES</div>
                          <AutoTextarea className="w-full text-xs print:text-[10px] font-bold text-gray-900 bg-transparent outline-none max-w-[80px]" value={data?.sizeRun || ''} onChange={e => setData({...data, sizeRun: e.target.value})} placeholder="-" />
                       </div>
                       <div className="space-y-1 flex-1 min-w-[150px]">
                          <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">FABRIC</div>
                          <AutoTextarea className="w-full text-xs print:text-[10px] font-bold text-gray-900 bg-transparent outline-none" value={data?.shell || ''} onChange={e => setData({...data, shell: e.target.value})} placeholder="-" />
                       </div>
                       <div className="space-y-1">
                          <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">MOQ</div>
                          <AutoTextarea className="w-full text-xs print:text-[10px] font-bold text-gray-900 bg-transparent outline-none max-w-[60px]" value={data?.moq || ''} onChange={e => setData({...data, moq: e.target.value})} placeholder="-" />
                       </div>
                       <div className="space-y-1">
                          <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">WHOLESALE</div>
                          <AutoTextarea className="w-full text-sm print:text-xs font-bold text-gray-900 bg-transparent outline-none max-w-[80px]" value={data?.wholesale || ''} onChange={e => setData({...data, wholesale: e.target.value})} placeholder="-" />
                       </div>
                       <div className="space-y-1">
                          <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">PRICE (MSRP)</div>
                          <AutoTextarea className="w-full text-sm print:text-xs font-bold text-gray-900 bg-transparent outline-none max-w-[80px]" value={data?.msrp || ''} onChange={e => setData({...data, msrp: e.target.value})} placeholder="-" />
                       </div>
                       <div className="space-y-1">
                          <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">DELIVERY</div>
                          <AutoTextarea className="w-full text-xs print:text-[10px] font-bold text-gray-900 bg-transparent outline-none max-w-[80px]" value={data?.deliveryWindow || ''} onChange={e => setData({...data, deliveryWindow: e.target.value})} placeholder="-" />
                       </div>
                     </div>
                  </div>

                  {/* Colors */}
                  <div className="border-t border-b border-gray-100 py-3 mt-6 mb-12 flex items-start gap-4 px-2">
                    <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider shrink-0 w-16 mt-1">COLORS</div>
                    <AutoTextarea className="w-full flex-1 text-xs print:text-[10px] font-bold text-gray-900 bg-transparent outline-none mt-1" value={data?.availableColors || ''} onChange={e => setData({...data, availableColors: e.target.value})} placeholder="Type colors here..." />
                  </div>
               </div>
               
               <footer className="w-full flex justify-between items-center text-[10px] print:text-[8px] uppercase font-bold tracking-wider text-gray-300 pt-4 mt-auto border-t border-gray-100">
                  <div>CONFIDENTIAL - WOVN GARMENT CATALOG</div>
                  <div>{new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</div>
               </footer>
             </div>
          </div>
          </>
          )}

        </div>
      </div>

      <AnimatePresence>
        {showHistory && (
          <motion.div 
             initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
             transition={{ type: "spring", stiffness: 300, damping: 30 }}
             className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 p-6 overflow-y-auto border-l border-gray-200"
             style={{ display: 'block' }} // Ensuring it's not hidden by print classes globally implicitly
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
               <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><History size={18} /> History</h3>
               <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-black transition-colors"><X size={20}/></button>
            </div>
             <div className="space-y-4">
               {data.activityLog?.length ? [...data.activityLog].reverse().map((log: any, i: number) => (
                 <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    <div className="font-bold text-gray-900 text-sm truncate">{formatName(log.user)}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{new Date(log.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                    <div className="text-gray-700 mt-2 text-xs">{log.message}</div>
                 </div>
               )) : <p className="text-gray-500 text-sm">No activity recorded yet.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={!!qrModalUrl} onClose={() => setQrModalUrl(null)} title="Live Camera Sync">
         <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
           <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-inner mb-6 flex justify-center w-full">
             {qrModalUrl && (
               <QRCodeSVG value={qrModalUrl} size={280} level={"H"} className="w-full max-w-[280px] h-auto object-contain mix-blend-multiply" />
             )}
           </div>
           <h3 className="text-xl font-serif font-bold text-gray-900 mb-2 text-center">Point Your Mobile Camera</h3>
           <p className="text-gray-500 font-medium text-center text-sm leading-relaxed max-w-sm">
             Scan this code with your smartphone to instantly open the companion camera. Any photos you take will sync directly into this tech pack's detail section in real-time.
           </p>
         </div>
      </Modal>

    </div>
  );
}
