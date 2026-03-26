import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Download, Save, ArrowLeft, Wand2, History, Lock, Unlock, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../contexts/AuthContext';
import { saveTechPack, getTechPack, uploadBase64Image } from '../services/dbService';
import { GarmentAnnotator } from '../components/editor/GarmentAnnotator';
import { motion, AnimatePresence } from 'framer-motion';

const AutoTextarea = ({ value, onChange, className }: { value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, className: string }) => {
  return (
    <div className="grid w-full relative">
      <textarea
        value={value}
        onChange={onChange}
        className={`resize-none overflow-hidden col-start-1 row-start-1 w-full h-full ${className}`}
        rows={1}
      />
      <div 
        className={`invisible whitespace-pre-wrap col-start-1 row-start-1 w-full break-words pointer-events-none ${className}`} 
        aria-hidden="true"
      >
        {value + ' '}
      </div>
    </div>
  );
};

const RichTextCallouts = ({ value, onChange, className }: { value: string, onChange: (v: string) => void, className: string }) => {
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
        rows={6}
      />
    );
  }

  const renderRichText = (text: string) => {
    if (!text) return <span className="text-gray-400 italic">Click to add construction details...</span>;
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
  const [vectorImageUrl, setVectorImageUrl] = useState('');
  const [showVector, setShowVector] = useState(false);
  const [packName, setPackName] = useState('Untitled Garment');
  
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const annotatorRef = useRef<HTMLDivElement>(null);

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
      setVectorImageUrl(newImageUrl);
      setShowVector(true);
      pushLog('Generated Vector Blueprint (AI)');
    } catch (e: any) {
      alert("Nano Banana Vectorization failed: " + e.message);
    } finally {
      setIsVectorizing(false);
    }
  };

  useEffect(() => {
    if (location.state?.techPack) {
      setData({
        ...location.state.techPack,
        userId: location.state.userId,
        isTeamEditable: location.state.isTeamEditable,
        activityLog: location.state.activityLog
      });
      setImageUrl(location.state.techPack?.images?.original || location.state.image || '');
      setVectorImageUrl(location.state.techPack?.images?.vector || '');
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
          setImageUrl(packInfo.techPack?.images?.original || packInfo.imageUrl);
          setVectorImageUrl(packInfo.techPack?.images?.vector || '');
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

      let finalVectorUrl = vectorImageUrl;
      if (vectorImageUrl.startsWith('data:')) {
        finalVectorUrl = await uploadBase64Image(vectorImageUrl, user.uid);
        setVectorImageUrl(finalVectorUrl);
      }

      let finalAnnotatedUrl = '';
      if (annotatedImg.startsWith('data:')) {
        finalAnnotatedUrl = await uploadBase64Image(annotatedImg, user.uid);
      }

      const techPackDataToSave = { ...data };
      if (techPackDataToSave.patternImage?.startsWith('data:')) {
        techPackDataToSave.patternImage = await uploadBase64Image(techPackDataToSave.patternImage, user.uid);
      }
      if (!techPackDataToSave.images) techPackDataToSave.images = {};
      techPackDataToSave.images.original = techPackDataToSave.images.original || imageUrl;
      techPackDataToSave.images.vector = finalVectorUrl || techPackDataToSave.images.vector || '';
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
        imageUrl, 
        techPackDataToSave, 
        user.email || 'Unknown',
        existingId,
        finalActivityLog,
        data.isTeamEditable ?? true
      );
      if (id === 'draft') {
        navigate(`/pack/${savedId}`, { replace: true, state: { techPack: techPackDataToSave, image: imageUrl, name: packName } });
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save tech pack");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = useReactToPrint({
    contentRef: exportRef,
    documentTitle: `${packName.replace(/\s+/g, '_')}_TechPack`,
    pageStyle: `
      @page {
        size: landscape;
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
        
        .print-image-wrapper > div {
           aspect-ratio: auto !important;
           height: 4.8in !important;
           margin: 0 auto;
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
          <Button onClick={() => { pushLog('Exported Tech Pack to PDF'); handleExport(); }} className="px-3 md:px-4 h-9 shadow-md shrink-0 bg-black text-white hover:bg-gray-800 transition-colors">
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
              <h1 className="text-3xl font-serif font-extrabold tracking-tight leading-none">TECH PACK</h1>
              <div className="text-gray-500 font-sans font-medium tracking-widest text-[11px] uppercase mt-1">GARMENT SPECIFICATION</div>
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

          <div className="grid grid-cols-12 gap-4 print:flex print:flex-col">
            {/* Left Column: Image & Callouts */}
            <div className="col-span-5 print:w-full print:mb-8 space-y-4">
              {imageUrl ? (
                <div>
                  <div className={`bg-white rounded-2xl ${vectorImageUrl ? 'print:flex print:gap-4 print:items-center' : ''} print-image-wrapper`}>
                    <div ref={annotatorRef} className="w-full">
                      <GarmentAnnotator 
                        imageUrl={showVector && vectorImageUrl ? vectorImageUrl : imageUrl} 
                        measurements={data.measurements}
                        onVectorize={handleVectorize}
                        isVectorizing={isVectorizing}
                      />
                    </div>
                    {vectorImageUrl && (
                      <div className="hidden print:block w-full h-full relative">
                         <img src={showVector ? imageUrl : vectorImageUrl} alt="Garment View" className="w-full h-full object-contain absolute inset-0" />
                      </div>
                    )}
                  </div>
                  {vectorImageUrl && (
                    <div className="flex justify-center items-center gap-2 mt-2 print:hidden">
                       <Button variant="secondary" size="sm" onClick={() => setShowVector(!showVector)} className="text-[10px] py-1 h-auto text-gray-600 bg-gray-100 hover:bg-gray-200">
                        {showVector ? "View Original Image" : "View Vector Blueprint"}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleVectorize} isLoading={isVectorizing} className="text-[10px] w-7 h-7 p-0 shrink-0 flex items-center justify-center text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Regenerate Vector Blueprint">
                        <Wand2 size={12} />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl border border-gray-200 aspect-[4/5] flex items-center justify-center p-2">
                  <div className="text-gray-400 text-xs">No Image Provided</div>
                </div>
              )}

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
            </div>

            {/* Right Column: Measurements & Fabrication */}
            <div className="col-span-7 print:w-full space-y-4">
              {/* Measurements Table */}
              <div className="print-force-new-page">
                <h3 className="text-lg font-serif font-bold border-b border-gray-200 pb-1 mb-2 text-gray-900 flex items-center justify-between leading-tight">
                  <span>Measurements</span>
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

          {/* Pattern & Making Section */}
          <div className="print-force-new-page pt-4 mt-8 print:mt-0 print:pt-0">
            <h3 className="text-lg font-serif font-bold text-gray-900 border-b border-gray-200 pb-1 mb-4 leading-tight">Construction Sketches & Pattern Specs</h3>
            <div className="grid grid-cols-12 gap-6 bg-white border border-gray-200 rounded-2xl p-6 print:border-none print:p-0">
               <div className="col-span-12 md:col-span-7 print:col-span-8 space-y-4">
                  {data?.patternImage ? (
                    <div className="relative group w-full">
                       <img src={data.patternImage} alt="Pattern Details" className="w-full object-contain bg-transparent print:mix-blend-multiply" />
                       <button onClick={() => setData({...data, patternImage: ''})} className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"><X size={16} /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full aspect-[4/3] bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors print:hidden p-4 text-center">
                      <div className="text-gray-400 text-xs font-semibold flex flex-col items-center gap-2">
                         <span className="text-2xl leading-none">+</span>
                         <span>Upload Pattern / Detail Sketches</span>
                      </div>
                      {vectorImageUrl && (
                         <Button 
                           onClick={(e) => { 
                              e.preventDefault(); 
                              e.stopPropagation(); 
                              setData({...data, patternImage: vectorImageUrl}); 
                              pushLog('Applied Vector Blueprint to Specs');
                           }} 
                           size="sm" 
                           variant="secondary" 
                           className="mt-4 text-[10px] py-1.5 h-auto relative z-10 font-bold tracking-wide"
                         >
                            Use Vector Blueprint
                         </Button>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                         if (e.target.files && e.target.files[0]) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setData({...data, patternImage: ev.target?.result as string});
                            reader.readAsDataURL(e.target.files[0]);
                         }
                      }} />
                    </label>
                  )}
               </div>
               <div className="col-span-12 md:col-span-5 print:col-span-4 space-y-4 md:border-l border-gray-100 md:pl-6 print:border-l-2 print:border-gray-800 print:pl-4 print:space-y-3">
                  <div className="space-y-1">
                     <div className="text-xs print:text-[10px] uppercase font-bold text-gray-900 underline">Development Comments</div>
                     <RichTextCallouts 
                       className="w-full bg-transparent outline-none min-h-[40px] text-xs print:text-[10px]" 
                       value={data?.developmentComments || ''} 
                       onChange={v => setData({...data, developmentComments: v})} 
                     />
                  </div>
                  <div className="space-y-1 mt-2 flex items-center gap-2">
                     <div className="text-xs print:text-[10px] font-bold text-gray-900 shrink-0">Shell:</div>
                     <AutoTextarea className="flex-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none text-xs print:text-[10px] font-medium" value={data?.shell || ''} onChange={e => setData({...data, shell: e.target.value})} />
                  </div>
                  <div className="space-y-1 flex items-center gap-2">
                     <div className="text-xs print:text-[10px] font-bold text-gray-900 shrink-0">Garment Treatment:</div>
                     <AutoTextarea className="flex-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none text-xs print:text-[10px] font-medium" value={data?.garmentTreatment || ''} onChange={e => setData({...data, garmentTreatment: e.target.value})} />
                  </div>
                  <div className="border-t border-gray-200 print:border-black my-4 print:my-2 w-full"></div>
                  <div className="space-y-1">
                     <div className="text-xs print:text-[10px] uppercase font-bold text-gray-900 underline mb-2">Making</div>
                     <RichTextCallouts 
                       className="w-full bg-transparent outline-none min-h-[250px] text-xs print:text-[10px]" 
                       value={typeof data?.making === 'string' ? data.making : ''} 
                       onChange={v => setData({...data, making: v})} 
                     />
                  </div>
               </div>
            </div>
          </div>
          
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
    </div>
  );
}
