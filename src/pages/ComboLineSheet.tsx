import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Download, X } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const AutoTextarea = ({ value, onChange, className, placeholder }: { value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, className: string, placeholder?: string }) => {
  return (
    <div className="grid w-full relative">
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`resize-none overflow-hidden col-start-1 row-start-1 w-full h-full bg-transparent ${className}`}
        rows={1}
      />
      <div 
        className={`invisible whitespace-pre-wrap col-start-1 row-start-1 w-full break-words pointer-events-none ${className}`} 
        aria-hidden="true"
      >
        {(value || placeholder) + ' '}
      </div>
    </div>
  );
};

export function ComboLineSheet() {
  const location = useLocation();
  const navigate = useNavigate();
  const exportRef = useRef<HTMLDivElement>(null);
  
  const [packs, setPacks] = useState<any[]>([]);
  const [title, setTitle] = useState('ARIA ELEVATED BASICS');
  const [season, setSeason] = useState('MGM RESORTS');
  const [wovnLogo, setWovnLogo] = useState('');
  const [clientLogo, setClientLogo] = useState('');

  useEffect(() => {
    if (location.state?.packs) {
      setPacks(location.state.packs);
    } else {
      navigate('/');
    }
  }, [location.state, navigate]);

  const updatePackField = (index: number, field: string, value: string) => {
    const newPacks = [...packs];
    newPacks[index] = { ...newPacks[index] };
    if (field === 'name') {
       newPacks[index].name = value;
    } else {
       if (!newPacks[index].techPack) newPacks[index].techPack = {};
       newPacks[index].techPack[field] = value;
    }
    setPacks(newPacks);
  };

  const handleExport = useReactToPrint({
    contentRef: exportRef,
    documentTitle: `${title.replace(/\s+/g, '_')}_Combo`,
    pageStyle: `
      @page {
        size: portrait;
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

        .print-force-new-page {
           page-break-before: always !important;
           break-before: page !important;
        }
           
        /* Hide UI elements that shouldn't print */
        .print-hidden {
           display: none !important;
        }
        
        textarea {
           resize: none;
           overflow: hidden;
           border: none;
        }
      }
    `
  });

  if (packs.length === 0) return <div className="p-20 text-center">Loading...</div>;

  const maxItemsPerPage = 4;
  const chunkedPacks = [];
  for (let i = 0; i < packs.length; i += maxItemsPerPage) {
    chunkedPacks.push(packs.slice(i, i + maxItemsPerPage));
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[900px] mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-3xl font-serif font-bold text-gray-900">Combo Line Sheet</h1>
        </div>
        <div>
          <Button onClick={() => handleExport()} className="px-4 h-9 shadow-md bg-black text-white hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-2 text-sm">
              <Download size={16} />
              <span className="font-semibold">Export PDF</span>
            </div>
          </Button>
        </div>
      </div>

      <div ref={exportRef} className="w-full bg-transparent text-gray-900 print-container">
        {chunkedPacks.map((chunk, pageIndex) => (
          <div key={pageIndex} className={`bg-white border border-gray-200 rounded-[40px] p-12 mb-10 shadow-sm print:shadow-none print:border-none print:p-0 print:mb-0 min-h-[10.5in] flex flex-col justify-between ${pageIndex > 0 ? 'print-force-new-page' : ''}`}>
            
            <div className="flex-1">
               <header className="flex justify-between items-start mb-14 print:mb-10">
                 <div className="flex flex-col text-left">
                   <input className="text-[28px] print:text-[22px] font-serif uppercase leading-none mb-1 text-gray-900 bg-transparent outline-none max-w-xs transition-colors hover:border-gray-200 border-b border-transparent focus:border-black" value={title} onChange={e => setTitle(e.target.value)} placeholder="COLLECTION NAME" />
                   <input className="text-xs print:text-[10px] uppercase font-bold text-gray-500 tracking-wider bg-transparent outline-none max-w-xs transition-colors hover:border-gray-200 border-b border-transparent focus:border-black" value={season} onChange={e => setSeason(e.target.value)} placeholder="SUBTITLE" />
                 </div>
                 <div className="flex flex-col items-center justify-center -mt-2 group relative">
                   {wovnLogo ? (
                     <img src={wovnLogo} alt="WOVN Logo" className="h-20 print:h-16 object-contain" />
                   ) : (
                     <>
                       <div className="text-[52px] print:text-[42px] font-serif tracking-widest font-black text-black leading-none py-2">WOV/N</div>
                       <div className="text-xs print:text-[9px] tracking-[0.4em] font-medium text-gray-500 mt-1 uppercase">Design Studio</div>
                     </>
                   )}
                   <label className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity print:hidden rounded-lg">
                     <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 px-3 py-1.5 rounded-full text-gray-700 shadow-sm border border-gray-200">Upload WOVN Logo</span>
                     <input type="file" className="hidden" accept="image/*" onChange={e => {
                         if(e.target.files && e.target.files[0]) {
                            const reader = new FileReader();
                            reader.onload = ev => setWovnLogo(ev.target?.result as string);
                            reader.readAsDataURL(e.target.files[0]);
                         }
                     }} />
                   </label>
                   {wovnLogo && (
                     <button onClick={(e) => { e.preventDefault(); setWovnLogo(''); }} className="absolute -top-2 -right-6 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 print:hidden z-10 p-1 bg-white rounded-full shadow-sm"><X size={14}/></button>
                   )}
                 </div>
                 <div className="text-right flex justify-end group relative">
                   {clientLogo ? (
                     <img src={clientLogo} alt="Client Logo" className="w-20 h-20 print:w-16 print:h-16 object-contain" />
                   ) : (
                     <div className="w-16 h-16 print:w-12 print:h-12 bg-black flex items-center justify-center rounded-sm">
                        <span className="text-white font-serif italic text-sm print:text-xs">Client</span>
                     </div>
                   )}
                   <label className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity print:hidden rounded-sm">
                     <span className="text-[10px] font-bold text-center bg-gray-100 px-3 py-1.5 rounded-full text-gray-700 shadow-sm border border-gray-200 uppercase tracking-wider">Upload</span>
                     <input type="file" className="hidden" accept="image/*" onChange={e => {
                         if(e.target.files && e.target.files[0]) {
                            const reader = new FileReader();
                            reader.onload = ev => setClientLogo(ev.target?.result as string);
                            reader.readAsDataURL(e.target.files[0]);
                         }
                     }} />
                   </label>
                   {clientLogo && (
                     <button onClick={(e) => { e.preventDefault(); setClientLogo(''); }} className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 print:hidden z-10 p-1 bg-white rounded-full shadow-sm"><X size={14}/></button>
                   )}
                 </div>
               </header>

               <div className="grid grid-cols-2 gap-x-12 gap-y-16 print:gap-y-10">
                  {chunk.map((pack, chunkIndex) => {
                    const img = pack.techPack?.lineSheetImage || pack.techPack?.images?.vector || pack.techPack?.images?.original || pack.imageUrl;
                    const globalIndex = pageIndex * maxItemsPerPage + chunkIndex;
                    return (
                      <div key={chunkIndex} className="flex flex-col">
                        <div className="w-full aspect-[4/5] bg-transparent relative mb-4 flex items-center justify-center overflow-hidden">
                          {img ? (
                            <img src={img} className="absolute inset-0 w-full h-[120%] -top-[10%] object-contain mix-blend-multiply print:scale-100" />
                          ) : (
                            <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-200">No Image</div>
                          )}
                        </div>
                        
                        <AutoTextarea 
                          className="text-2xl print:text-xl font-serif text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-black transition-colors mb-4 outline-none w-full" 
                          value={pack.name || ''} 
                          onChange={e => updatePackField(globalIndex, 'name', e.target.value)} 
                          placeholder="Product Name" 
                        />
                        
                        <div className="border-t border-gray-200 print:border-gray-300 pt-3 grid grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <div className="space-y-0.5">
                               <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">WHOLESALE</div>
                               <AutoTextarea className="w-full text-sm print:text-xs font-bold text-black border-b border-transparent hover:border-gray-300 outline-none" value={pack.techPack?.wholesale || pack.wholesale || ''} onChange={e => updatePackField(globalIndex, 'wholesale', e.target.value)} placeholder="$0.00" />
                            </div>
                            <div className="space-y-0.5">
                               <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">SIZES</div>
                               <AutoTextarea className="w-full text-xs print:text-[10px] font-bold text-black border-b border-transparent hover:border-gray-300 outline-none" value={pack.techPack?.sizeRun || pack.sizeRun || ''} onChange={e => updatePackField(globalIndex, 'sizeRun', e.target.value)} placeholder="-" />
                            </div>
                            <div className="space-y-0.5">
                               <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">FABRIC</div>
                               <AutoTextarea className="w-full text-xs print:text-[10px] font-bold text-black border-b border-transparent hover:border-gray-300 outline-none" value={pack.techPack?.shell || pack.techPack?.fabrication?.[0]?.material || pack.shell || ''} onChange={e => updatePackField(globalIndex, 'shell', e.target.value)} placeholder="-" />
                            </div>
                            <div className="space-y-0.5">
                               <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">MOQ</div>
                               <AutoTextarea className="w-full text-xs print:text-[10px] font-bold text-black border-b border-transparent hover:border-gray-300 outline-none" value={pack.techPack?.moq || pack.moq || ''} onChange={e => updatePackField(globalIndex, 'moq', e.target.value)} placeholder="-" />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-0.5">
                               <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">PRICE (MSRP)</div>
                               <AutoTextarea className="w-full text-sm print:text-xs font-bold text-black border-b border-transparent hover:border-gray-300 outline-none" value={pack.techPack?.msrp || pack.msrp || ''} onChange={e => updatePackField(globalIndex, 'msrp', e.target.value)} placeholder="$0.00" />
                            </div>
                            
                            <div className="h-6 print:h-[22px] hidden print:block bg-transparent opacity-0 pointer-events-none p-0 overflow-hidden text-transparent select-none">-</div>
                            <div className="h-6 print:h-[22px] hidden print:block bg-transparent opacity-0 pointer-events-none p-0 overflow-hidden text-transparent select-none">-</div>
                            
                            <div className="space-y-0.5">
                               <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider">DELIVERY</div>
                               <AutoTextarea className="w-full text-xs print:text-[10px] font-bold text-black border-b border-transparent hover:border-gray-300 outline-none" value={pack.techPack?.deliveryWindow || pack.deliveryWindow || ''} onChange={e => updatePackField(globalIndex, 'deliveryWindow', e.target.value)} placeholder="-" />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-start gap-2 border-none">
                          <div className="text-[10px] print:text-[8px] uppercase font-bold text-gray-400 tracking-wider mt-1 shrink-0">COLORS:</div>
                          <AutoTextarea 
                            className="w-full text-xs font-bold text-black border-none outline-none mt-1" 
                            value={pack.techPack?.availableColors || pack.availableColors || ''} 
                            onChange={e => updatePackField(globalIndex, 'availableColors', e.target.value)} 
                            placeholder="Type colors..." 
                          />
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
            
            <footer className="w-full flex justify-between items-center text-[10px] print:text-[8px] uppercase font-bold tracking-wider text-gray-300 pt-6 mt-12 border-t border-gray-100">
               <div>CONFIDENTIAL - WOVN GARMENT CATALOG</div>
               <div>{new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</div>
            </footer>
          </div>
        ))}
      </div>
    </div>
  );
}
