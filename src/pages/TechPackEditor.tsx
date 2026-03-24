import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Download, Save, ArrowLeft, Wand2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { saveTechPack, getTechPack, uploadBase64Image } from '../services/dbService';
import { GarmentAnnotator } from '../components/editor/GarmentAnnotator';

const AutoTextarea = ({ value, onChange, className }: { value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, className: string }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={`resize-none overflow-hidden block ${className}`}
      rows={1}
    />
  );
};

export function TechPackEditor() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const exportRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({ measurements: [], callouts: [], fabrication: [] });
  const [imageUrl, setImageUrl] = useState('');
  const [vectorImageUrl, setVectorImageUrl] = useState('');
  const [showVector, setShowVector] = useState(false);
  const [packName, setPackName] = useState('Untitled Garment');
  
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const annotatorRef = useRef<HTMLDivElement>(null);

  const handleVectorize = async () => {
    let apiKey = import.meta.env.VITE_NANOBANANA_API_KEY;
    if (!apiKey) {
      apiKey = window.prompt("Please enter your NanoBanana API Key to generate a clean vector.:");
    }
    if (!apiKey) return;
    
    setIsVectorizing(true);
    try {
      const { vectorizeGarmentImage } = await import('../services/nanobananaService');
      const newImageUrl = await vectorizeGarmentImage(imageUrl, apiKey);
      setVectorImageUrl(newImageUrl);
      setShowVector(true);
    } catch (e: any) {
      alert("Nano Banana Vectorization failed: " + e.message);
    } finally {
      setIsVectorizing(false);
    }
  };

  useEffect(() => {
    if (location.state?.techPack) {
      setData(location.state.techPack);
      setImageUrl(location.state.techPack?.images?.original || location.state.image || '');
      setVectorImageUrl(location.state.techPack?.images?.vector || '');
      if (location.state.name) setPackName(location.state.name);
      setIsLoading(false);
    } else if (id && id !== 'draft') {
      getTechPack(id).then((packInfo) => {
        if (packInfo) {
          setData(packInfo.techPack);
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
      if (!techPackDataToSave.images) techPackDataToSave.images = {};
      techPackDataToSave.images.original = techPackDataToSave.images.original || imageUrl;
      techPackDataToSave.images.vector = finalVectorUrl || techPackDataToSave.images.vector || '';
      techPackDataToSave.images.annotated = finalAnnotatedUrl;

      const existingId = id === 'draft' ? undefined : id;
      const savedId = await saveTechPack(user.uid, packName, imageUrl, techPackDataToSave, existingId);
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

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`${packName.replace(/\s+/g, '_')}_TechPack.pdf`);
    } catch (e) {
      console.error(e);
      alert('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const updateMeasurement = (index: number, field: string, value: string) => {
    const newData = { ...data };
    newData.measurements[index][field] = value;
    setData(newData);
  };

  const updateFabrication = (index: number, field: string, value: string) => {
    const newData = { ...data };
    newData.fabrication[index][field] = value;
    setData(newData);
  };

  const updateCallout = (index: number, value: string) => {
    const newData = { ...data };
    newData.callouts[index].description = value;
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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1000px] mx-auto">
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
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} isLoading={isSaving} variant="secondary" className="gap-2">
            <Save size={16} />
            Save Tech Pack
          </Button>
          <Button onClick={handleExport} isLoading={isExporting} className="gap-2 shadow-md">
            <Download size={16} />
            Export Presentation
          </Button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm relative">
        {/* Export Container */}
        <div ref={exportRef} className="p-10 w-full bg-white text-gray-900 print-container">
          
          <header className="border-b border-gray-200 pb-6 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-serif font-extrabold tracking-tight">TECH PACK</h1>
              <div className="text-gray-500 font-sans font-medium tracking-widest text-sm mt-2 uppercase">GARMENT SPECIFICATION</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-sm">Date: {new Date().toLocaleDateString()}</div>
              <div className="text-gray-500 text-sm mt-1">Ref: TP-{Math.floor(Math.random() * 10000)}</div>
            </div>
          </header>

          <div className="grid grid-cols-12 gap-10">
            {/* Left Column: Image & Callouts */}
            <div className="col-span-5 space-y-8">
              {imageUrl ? (
                <div>
                  <div ref={annotatorRef} className="bg-white rounded-2xl">
                    <GarmentAnnotator 
                      imageUrl={showVector && vectorImageUrl ? vectorImageUrl : imageUrl} 
                      measurements={data.measurements}
                      onVectorize={!vectorImageUrl ? handleVectorize : undefined}
                      isVectorizing={isVectorizing}
                    />
                  </div>
                  {vectorImageUrl && (
                    <div className="flex justify-center mt-3">
                      <Button variant="secondary" size="sm" onClick={() => setShowVector(!showVector)} className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200">
                        {showVector ? "View Original Image" : "View Vector Blueprint"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl border border-gray-200 aspect-[4/5] flex items-center justify-center p-6">
                  <div className="text-gray-400">No Image Provided</div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-4">
                  <h3 className="text-xl font-serif font-bold text-gray-900">Construction Details</h3>
                </div>
                <ol className="space-y-4 pl-5 list-decimal marker:text-black marker:font-bold text-gray-700">
                  {data.callouts.map((callout: any, i: number) => (
                    <li key={i} className="pl-2">
                      <AutoTextarea 
                        className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-black outline-none transition-colors"
                        value={callout.description}
                        onChange={(e) => updateCallout(i, e.target.value)}
                      />
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Right Column: Measurements & Fabrication */}
            <div className="col-span-7 space-y-10">
              {/* Measurements Table */}
              <div>
                <h3 className="text-xl font-serif font-bold border-b border-gray-200 pb-2 mb-4 text-gray-900 flex items-center justify-between">
                  <span>Measurements</span>
                </h3>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-medium">Point of Measure</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium w-24">Spec</th>
                        <th className="px-3 py-3 font-medium w-16">Tol.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.measurements.map((m: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none font-medium text-gray-900" value={m.point} onChange={e => updateMeasurement(i, 'point', e.target.value)} />
                          </td>
                          <td className="px-4 py-3 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-500 text-xs" value={m.description} onChange={e => updateMeasurement(i, 'description', e.target.value)} />
                          </td>
                          <td className="px-4 py-3 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-900 font-mono font-semibold" value={m.value} onChange={e => updateMeasurement(i, 'value', e.target.value)} />
                          </td>
                          <td className="px-3 py-3 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-400 font-mono text-[10px]" value={m.tolerance} onChange={e => updateMeasurement(i, 'tolerance', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fabrication Table */}
              <div>
                <h3 className="text-xl font-serif font-bold border-b border-gray-200 pb-2 mb-4 text-gray-900">Fabrication / Materials</h3>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-medium">Placement</th>
                        <th className="px-4 py-3 font-medium">Material</th>
                        <th className="px-4 py-3 font-medium">Weight</th>
                        <th className="px-4 py-3 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fabrication.map((f: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none font-medium text-gray-900" value={f.placement} onChange={e => updateFabrication(i, 'placement', e.target.value)} />
                          </td>
                          <td className="px-4 py-3 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-600 text-xs" value={f.material} onChange={e => updateFabrication(i, 'material', e.target.value)} />
                          </td>
                          <td className="px-4 py-3 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-500 text-xs" value={f.weight} onChange={e => updateFabrication(i, 'weight', e.target.value)} />
                          </td>
                          <td className="px-4 py-3 align-top">
                             <AutoTextarea className="w-full bg-transparent outline-none text-gray-400 text-[10px]" value={f.notes} onChange={e => updateFabrication(i, 'notes', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
