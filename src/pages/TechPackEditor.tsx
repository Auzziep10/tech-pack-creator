import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Download, Save, ArrowLeft } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { saveTechPack, getTechPack } from '../services/dbService';

export function TechPackEditor() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const exportRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>({ measurements: [], callouts: [], fabrication: [] });
  const [imageUrl, setImageUrl] = useState('');
  const [packName, setPackName] = useState('Untitled Garment');
  
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (location.state?.techPack) {
      setData(location.state.techPack);
      setImageUrl(location.state.image || '');
      if (location.state.name) setPackName(location.state.name);
      setIsLoading(false);
    } else if (id && id !== 'draft') {
      getTechPack(id).then((packInfo) => {
        if (packInfo) {
          setData(packInfo.techPack);
          setImageUrl(packInfo.imageUrl);
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
      const existingId = id === 'draft' ? undefined : id;
      const savedId = await saveTechPack(user.uid, packName, imageUrl, data, existingId);
      if (id === 'draft') {
        navigate(`/pack/${savedId}`, { replace: true, state: { techPack: data, image: imageUrl, name: packName } });
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
        backgroundColor: '#111111',
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

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;

  if (!data?.measurements?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-400 mb-4">No Tech Pack data found.</p>
        <Button onClick={() => navigate('/create')}>Create New Tech Pack</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <input 
            value={packName} 
            onChange={(e) => setPackName(e.target.value)} 
            className="text-3xl font-bold tracking-tight text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-blue-500 outline-none transition-all px-1" 
            placeholder="Garment Name"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} isLoading={isSaving} variant="secondary" className="gap-2">
            <Save size={16} />
            Save Tech Pack
          </Button>
          <Button onClick={handleExport} isLoading={isExporting} className="gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Download size={16} />
            Export Presentation
          </Button>
        </div>
      </div>

      <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#111] shadow-2xl relative">
        {/* Export Container */}
        <div ref={exportRef} className="p-10 w-full bg-[#111] text-white print-container">
          
          <header className="border-b border-white/10 pb-6 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">TECH PACK</h1>
              <div className="text-blue-400 font-medium tracking-widest text-sm mt-2 uppercase">GARMENT SPECIFICATION</div>
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-sm">Date: {new Date().toLocaleDateString()}</div>
              <div className="text-gray-400 text-sm mt-1">Ref: TP-{Math.floor(Math.random() * 10000)}</div>
            </div>
          </header>

          <div className="grid grid-cols-12 gap-10">
            {/* Left Column: Image & Callouts */}
            <div className="col-span-5 space-y-8">
              <div className="bg-white/[0.02] rounded-2xl border border-white/5 aspect-[4/5] flex items-center justify-center p-6 relative">
                {imageUrl && <img src={imageUrl} alt="Mockup" className="max-w-full max-h-full object-contain drop-shadow-2xl" />}
                {!imageUrl && <div className="text-gray-600">No Image Provided</div>}
              </div>

              <div>
                <h3 className="text-xl font-bold border-b border-white/10 pb-2 mb-4 text-blue-400">Construction Details</h3>
                <ol className="space-y-4 pl-5 list-decimal marker:text-blue-500 marker:font-bold text-gray-300">
                  {data.callouts.map((callout: any, i: number) => (
                    <li key={i} className="pl-2">
                      <input 
                        className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-blue-500 outline-none transition-colors"
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
                <h3 className="text-xl font-bold border-b border-white/10 pb-2 mb-4 text-blue-400 flex items-center justify-between">
                  <span>Measurements</span>
                </h3>
                <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 font-medium">Point of Measure</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium w-24">Spec</th>
                        <th className="px-3 py-3 font-medium w-16">Tol.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.measurements.map((m: any, i: number) => (
                        <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                             <input className="w-full bg-transparent outline-none font-medium text-white" value={m.point} onChange={e => updateMeasurement(i, 'point', e.target.value)} />
                          </td>
                          <td className="px-4 py-3">
                             <input className="w-full bg-transparent outline-none text-gray-400 text-xs" value={m.description} onChange={e => updateMeasurement(i, 'description', e.target.value)} />
                          </td>
                          <td className="px-4 py-3">
                             <input className="w-full bg-transparent outline-none text-blue-300 font-mono" value={m.value} onChange={e => updateMeasurement(i, 'value', e.target.value)} />
                          </td>
                          <td className="px-3 py-3">
                             <input className="w-full bg-transparent outline-none text-gray-500 font-mono text-[10px]" value={m.tolerance} onChange={e => updateMeasurement(i, 'tolerance', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fabrication Table */}
              <div>
                <h3 className="text-xl font-bold border-b border-white/10 pb-2 mb-4 text-blue-400">Fabrication / Materials</h3>
                <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 font-medium">Placement</th>
                        <th className="px-4 py-3 font-medium">Material</th>
                        <th className="px-4 py-3 font-medium">Weight</th>
                        <th className="px-4 py-3 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fabrication.map((f: any, i: number) => (
                        <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 align-top">
                             <textarea rows={2} className="w-full bg-transparent outline-none font-medium text-white resize-none" value={f.placement} onChange={e => updateFabrication(i, 'placement', e.target.value)} />
                          </td>
                          <td className="px-4 py-3 align-top">
                             <textarea rows={2} className="w-full bg-transparent outline-none text-gray-300 resize-none text-xs" value={f.material} onChange={e => updateFabrication(i, 'material', e.target.value)} />
                          </td>
                          <td className="px-4 py-3 align-top">
                             <input className="w-full bg-transparent outline-none text-gray-400" value={f.weight} onChange={e => updateFabrication(i, 'weight', e.target.value)} />
                          </td>
                          <td className="px-4 py-3 align-top">
                             <textarea rows={2} className="w-full bg-transparent outline-none text-gray-500 text-[10px] resize-none" value={f.notes} onChange={e => updateFabrication(i, 'notes', e.target.value)} />
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
