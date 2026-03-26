import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Download } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

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

export function ComboLineSheet() {
  const location = useLocation();
  const navigate = useNavigate();
  const exportRef = useRef<HTMLDivElement>(null);
  
  const [packs, setPacks] = useState<any[]>([]);
  const [title, setTitle] = useState('COMBO LINE SHEET');
  const [season, setSeason] = useState('SEASON 2026');

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
    newPacks[index][field] = value;
    setPacks(newPacks);
  };

  const updatePropertyField = (index: number, field: string, value: string) => {
    const newPacks = [...packs];
    newPacks[index] = { ...newPacks[index] };
    if (!newPacks[index].properties) newPacks[index].properties = {};
    newPacks[index].properties[field] = value;
    setPacks(newPacks);
  };

  const handleExport = useReactToPrint({
    contentRef: exportRef,
    documentTitle: `${title.replace(/\s+/g, '_')}_Combo`,
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
        
        table {
           width: 100% !important;
           table-layout: fixed;
           border-collapse: collapse;
        }
        td, th {
           border: 1px solid #f3f4f6 !important;
           word-break: break-word;
        }
        
        textarea {
           resize: none;
           overflow: hidden;
           border: none;
        }

        .print-force-new-page {
           page-break-before: always !important;
           break-before: page !important;
        }
           
        /* Hide UI elements that shouldn't print */
        .print-hidden {
           display: none !important;
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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-20">
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
          <div key={pageIndex} className={`bg-white border border-gray-200 rounded-3xl p-10 mb-10 shadow-sm print:shadow-none print:border-none print:p-0 print:mb-0 ${pageIndex > 0 ? 'print-force-new-page' : ''}`}>
            
            <header className="border-b border-gray-400 pb-2 mb-6 flex justify-between items-end">
               <div>
                 <input 
                   value={title} 
                   onChange={(e) => setTitle(e.target.value)} 
                   className="text-3xl print:text-2xl font-serif font-extrabold tracking-tight uppercase leading-none bg-transparent border-b border-transparent hover:border-gray-200 focus:border-black outline-none transition-all w-full max-w-lg" 
                   placeholder="COMBO LINE SHEET TITLE"
                 />
               </div>
               <div className="text-right flex flex-col items-end">
                 <div className="text-gray-800 font-bold text-xs print:text-[10px] uppercase">SEASON</div>
                 <input 
                   value={season} 
                   onChange={(e) => setSeason(e.target.value)} 
                   className="text-sm print:text-xs font-bold text-right bg-transparent border-b border-transparent hover:border-gray-200 focus:border-black outline-none transition-all uppercase" 
                   placeholder="SPRING / SUMMER 2026"
                 />
               </div>
            </header>

            <div className="overflow-hidden bg-white border border-gray-100 rounded-[20px] ring-1 ring-gray-200">
               <table className="w-full text-sm print:text-xs" style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                     {/* Images Row */}
                     <tr>
                        <td className="w-32 print:w-24 border border-gray-100 p-2 bg-gray-50/50 font-bold align-middle text-center text-gray-400 uppercase text-xs tracking-wider">
                           Design
                        </td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-6 align-middle relative h-48 print:h-44">
                             {pack.lineSheetImage || pack.images?.vector || pack.images?.original || pack.imageUrl ? (
                               <img 
                                 src={pack.lineSheetImage || pack.images?.vector || pack.images?.original || pack.imageUrl} 
                                 alt={pack.name} 
                                 className="w-full h-full object-contain mix-blend-multiply"
                               />
                             ) : (
                               <div className="w-full h-full bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 text-xs">No Image</div>
                             )}
                          </td>
                        ))}
                        {/* Pad empty cells if chunk < 4 */}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-img-${i}`} className="border border-gray-100 p-4 align-middle h-48 print:h-44 bg-gray-50/30"></td>
                        ))}
                     </tr>

                     {/* Name Row */}
                     <tr>
                        <td className="border border-gray-100 p-2 bg-gray-50/50 font-bold text-[10px] text-gray-400 tracking-wider uppercase">Product Name</td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-3 font-bold text-center uppercase bg-gray-50/30">
                             <AutoTextarea className="w-full bg-transparent outline-none text-center font-bold" value={pack.name || ''} onChange={e => updatePackField(pageIndex * maxItemsPerPage + chunkIndex, 'name', e.target.value)} />
                          </td>
                        ))}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-name-${i}`} className="border border-gray-100 p-3 bg-gray-50/30"></td>
                        ))}
                     </tr>

                     {/* Style Row */}
                     <tr>
                        <td className="border border-gray-100 p-2 bg-gray-50/50 font-bold text-[10px] text-gray-400 tracking-wider uppercase">Style</td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-3 font-mono text-gray-900">
                             <AutoTextarea className="w-full bg-transparent outline-none font-mono" value={pack.properties?.style || ''} onChange={e => updatePropertyField(pageIndex * maxItemsPerPage + chunkIndex, 'style', e.target.value)} />
                          </td>
                        ))}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-style-${i}`} className="border border-gray-100 p-3"></td>
                        ))}
                     </tr>

                     {/* Sizes Row */}
                     <tr>
                        <td className="border border-gray-100 p-2 bg-gray-50/50 font-bold text-[10px] text-gray-400 tracking-wider uppercase">Sizes</td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-3 text-gray-900 font-medium">
                             <AutoTextarea className="w-full bg-transparent outline-none" value={pack.sizeRun || 'S, M, L, XL'} onChange={e => updatePackField(pageIndex * maxItemsPerPage + chunkIndex, 'sizeRun', e.target.value)} />
                          </td>
                        ))}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-sizes-${i}`} className="border border-gray-100 p-3"></td>
                        ))}
                     </tr>

                     {/* Material Row */}
                     <tr>
                        <td className="border border-gray-100 p-2 bg-gray-50/50 font-bold text-[10px] text-gray-400 tracking-wider uppercase">Material</td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-3 text-gray-900 font-medium">
                             <AutoTextarea className="w-full bg-transparent outline-none" value={pack.shell || pack.fabrication?.[0]?.material || pack.bom?.[0]?.component || '100% Cotton'} onChange={e => updatePackField(pageIndex * maxItemsPerPage + chunkIndex, 'shell', e.target.value)} />
                          </td>
                        ))}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-material-${i}`} className="border border-gray-100 p-3"></td>
                        ))}
                     </tr>

                     {/* MSRP / RRP Row */}
                     <tr>
                        <td className="border border-gray-100 p-2 bg-gray-50/50 font-bold text-[10px] text-gray-400 tracking-wider uppercase">RRP / MSRP</td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-3 text-gray-900 font-bold">
                             <AutoTextarea className="w-full bg-transparent outline-none font-bold text-gray-900" value={pack.msrp || ''} onChange={e => updatePackField(pageIndex * maxItemsPerPage + chunkIndex, 'msrp', e.target.value)} />
                          </td>
                        ))}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-msrp-${i}`} className="border border-gray-100 p-3"></td>
                        ))}
                     </tr>

                     {/* Wholesale Price Row */}
                     <tr>
                        <td className="border border-gray-100 p-2 bg-gray-50/50 font-bold text-[10px] text-gray-400 tracking-wider uppercase">Wholesale Price</td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-3 text-gray-900 font-bold">
                             <AutoTextarea className="w-full bg-transparent outline-none font-bold text-gray-900" value={pack.wholesale || ''} onChange={e => updatePackField(pageIndex * maxItemsPerPage + chunkIndex, 'wholesale', e.target.value)} />
                          </td>
                        ))}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-wholesale-${i}`} className="border border-gray-100 p-3"></td>
                        ))}
                     </tr>

                     {/* Min Order Qty Row */}
                     <tr>
                        <td className="border border-gray-100 p-2 bg-gray-50/50 font-bold text-[10px] text-gray-400 tracking-wider uppercase">Min Order Qty</td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-3 text-gray-900 font-medium">
                             <AutoTextarea className="w-full bg-transparent outline-none" value={pack.moq || ''} onChange={e => updatePackField(pageIndex * maxItemsPerPage + chunkIndex, 'moq', e.target.value)} />
                          </td>
                        ))}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-moq-${i}`} className="border border-gray-100 p-3"></td>
                        ))}
                     </tr>

                     {/* Delivery Row */}
                     <tr>
                        <td className="border border-gray-100 p-2 bg-gray-50/50 font-bold text-[10px] text-gray-400 tracking-wider uppercase">Delivery Window</td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-3 text-gray-900 font-medium">
                             <AutoTextarea className="w-full bg-transparent outline-none" value={pack.deliveryWindow || ''} onChange={e => updatePackField(pageIndex * maxItemsPerPage + chunkIndex, 'deliveryWindow', e.target.value)} />
                          </td>
                        ))}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-delivery-${i}`} className="border border-gray-100 p-3"></td>
                        ))}
                     </tr>

                     {/* Colors & SKU block label row */}
                     <tr>
                        <td className="border border-gray-100 p-2 bg-gray-50/50 font-bold text-[10px] text-gray-400 tracking-wider uppercase align-top">Available Colors</td>
                        {chunk.map((pack, chunkIndex) => (
                          <td key={chunkIndex} className="border border-gray-100 p-3">
                             <div className="text-[9px] print:text-[8px] uppercase font-bold text-gray-400 mb-1 border-b border-gray-100 pb-0.5">Colors & SKU</div>
                             <AutoTextarea 
                               className="w-full bg-transparent outline-none text-[11px] print:text-[10px] leading-relaxed font-medium" 
                               value={pack.availableColors || 'Default Color'} 
                               onChange={e => updatePackField(pageIndex * maxItemsPerPage + chunkIndex, 'availableColors', e.target.value)} 
                             />
                          </td>
                        ))}
                        {Array.from({ length: maxItemsPerPage - chunk.length }).map((_, i) => (
                          <td key={`empty-colors-${i}`} className="border border-gray-100 p-3"></td>
                        ))}
                     </tr>

                  </tbody>
               </table>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
