import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { 
  Download, 
  Lock, 
  Eye, 
  Maximize2, 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Sparkles,
  Layers,
  FileText,
  Palette,
  Upload,
  Edit3
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { subscribeToTechPack, TechPackData, uploadGarmentImage } from '../services/dbService';
import { GarmentAnnotator } from '../components/editor/GarmentAnnotator';
import { DetailAnnotator } from '../components/editor/DetailAnnotator';
import { motion, AnimatePresence } from 'framer-motion';

const COLOR_NAME_TO_HEX: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  navy: '#1E293B',
  grey: '#64748B',
  gray: '#64748B',
  'charcoal grey': '#374151',
  'charcoal gray': '#374151',
  charcoal: '#374151',
  red: '#DC2626',
  blue: '#2563EB',
  green: '#16A34A',
  yellow: '#CA8A04',
  beige: '#D4B996',
  brown: '#78350F',
  olive: '#4D5D43',
  khaki: '#C3B091',
  burgundy: '#800020',
  cream: '#FFFDD0',
  tan: '#D2B48C',
  orange: '#EA580C',
  purple: '#9333EA',
  pink: '#EC4899',
  teal: '#0D9488',
  oat: '#CFC9BD',
  bone: '#E5E2D9',
  'light smoke': '#BEBCBD',
  sandstone: '#A49B8E',
  taupe: '#8B8589',
  sage: '#9CAF88',
  slate: '#708090',
  rust: '#B7410E',
  camel: '#C19A6B',
  indigo: '#4B0082',
  forest: '#065F46',
  sand: '#D0C9B6'
};

const labToHex = (lab?: number[]) => {
  if (!lab || lab.length < 3) return '';
  const [L, a, b] = lab;
  const y = (L + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const fn = (t: number) => t > 0.206897 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787;
  const X = 95.047 * fn(x);
  const Y = 100.000 * fn(y);
  const Z = 108.883 * fn(z);

  let r = X * 0.032406 + Y * -0.015372 + Z * -0.004986;
  let g = X * -0.009689 + Y * 0.018758 + Z * 0.000415;
  let bl = X * 0.000557 + Y * -0.002040 + Z * 0.010570;

  const gamma = (c: number) => {
    const clamped = Math.max(0, Math.min(1, c / 100));
    return clamped > 0.0031308 ? 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055 : 12.92 * clamped;
  };

  const R = Math.round(gamma(r) * 255);
  const G = Math.round(gamma(g) * 255);
  const B = Math.round(gamma(bl) * 255);

  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1).toUpperCase()}`;
};

const resolveHex = (cw: any) => {
  if (cw?.hex && cw.hex.startsWith('#')) return cw.hex;
  const fromLab = labToHex(cw?.lab);
  if (fromLab) return fromLab;
  const nameKey = (cw?.name || '').trim().toLowerCase();
  if (COLOR_NAME_TO_HEX[nameKey]) return COLOR_NAME_TO_HEX[nameKey];
  return '#1A1A1A';
};

const forceDownload = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed', error);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

const autoConvert = (str: string | undefined, targetUnit: 'in' | 'cm') => {
  if (!str || !str.trim()) return str;
  const val = str.trim();
  if (targetUnit === 'cm') {
    const dec = parseFractionToDecimal(val);
    if (dec === null) return str;
    return (dec * 2.54).toFixed(2).replace(/\.00$/, '');
  } else {
    const float = parseFloat(val);
    if (isNaN(float)) return str;
    const dec = float / 2.54;
    return decimalToNearestFractionStr(dec, 8);
  }
};

const renderRichText = (text: string) => {
  if (!text) return <span className="text-gray-400 italic">No notes provided.</span>;
  return text.split('\n').map((line, i) => {
    const isHeader = /^\d+\.\s/.test(line.trim());
    const isBullet = line.trim().startsWith('-');
    if (isHeader) return <div key={i} className="font-bold text-gray-900 mt-4 mb-1.5 first:mt-0 print:mt-2 print:mb-1">{line.trim()}</div>;
    if (isBullet) return <div key={i} className="ml-4 pl-3 relative before:content-[''] before:w-1.5 before:h-1.5 before:bg-gray-500 before:rounded-full before:absolute before:left-[-3px] before:top-2 text-gray-700 mb-1">{line.replace(/^\s*-\s*/, '')}</div>;
    if (line.trim() === '') return <div key={i} className="h-2"></div>;
    return <div key={i} className="text-gray-700 mb-1">{line}</div>;
  });
};

export function SharedTechPack() {
  const { id } = useParams<{ id: string }>();
  const exportRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [packData, setPackData] = useState<TechPackData | null>(null);
  const [data, setData] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [packName, setPackName] = useState('Untitled Garment');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [hiddenGalleryImages, setHiddenGalleryImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'techpack' | 'linesheet'>('techpack');
  const [globalUnit, setGlobalUnit] = useState<'in' | 'cm'>('cm');
  const [activeSizeTab, setActiveSizeTab] = useState<string>('M');
  const [activeLanguage, setActiveLanguage] = useState('English');

  // Photo Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Line Sheet Branding & Logo State
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [showBrandTextModal, setShowBrandTextModal] = useState(false);
  const [brandNameInput, setBrandNameInput] = useState('');
  const [brandSubtitleInput, setBrandSubtitleInput] = useState('');

  // Authenticate anonymously if user is not logged in so Firestore reads succeed
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch(err => {
          console.error("Anonymous authentication error:", err);
        });
      }
    });
    return () => unsub();
  }, []);

  // Fetch Tech Pack real-time
  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const unsub = subscribeToTechPack(id, (docData) => {
      if (docData) {
        setPackData(docData);
        const p = docData.techPack || {};
        setData(p);
        setPackName(docData.name || 'Untitled Garment');

        const initialUnit = p.unit || 'cm';
        setGlobalUnit(initialUnit);

        const initialBaseSize = p.properties?.baseSize || 'M';
        setActiveSizeTab(initialBaseSize);

        const hiddenImgs: string[] = p.hiddenGalleryImages || (docData as any).hiddenGalleryImages || [];
        setHiddenGalleryImages(hiddenImgs);

        const checkHidden = (url: string) => {
          if (!url) return false;
          return hiddenImgs.includes(url) || hiddenImgs.some(h => h && (h === url || decodeURIComponent(h) === decodeURIComponent(url)));
        };

        const initialImg = p.images?.original || docData.imageUrl || '';
        const docGallery: string[] = p.gallery || [];
        const combined = [...docGallery];
        if (docData.imageUrl && !combined.includes(docData.imageUrl)) {
          combined.unshift(docData.imageUrl);
        }
        if (initialImg && !combined.includes(initialImg)) {
          combined.unshift(initialImg);
        }

        // Strictly filter out any images that are hidden
        const visibleGallery = combined.filter(img => !checkHidden(img));
        setGalleryImages(visibleGallery);

        const coverImg = (initialImg && !checkHidden(initialImg))
          ? initialImg
          : (visibleGallery[0] || '');

        setImageUrl((prev) => (prev && visibleGallery.includes(prev) && !checkHidden(prev) ? prev : coverImg));
      } else {
        setPackData(null);
        setData(null);
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, [id]);

  const toggleUnit = () => {
    const nextUnit = globalUnit === 'in' ? 'cm' : 'in';
    setGlobalUnit(nextUnit);
    if (data?.measurements) {
      setData((prev: any) => {
        const newMs = (prev.measurements || []).map((m: any) => ({
          ...m,
          value: autoConvert(m.value, nextUnit),
          tolMinus: autoConvert(m.tolMinus, nextUnit),
          tolPlus: autoConvert(m.tolPlus, nextUnit),
          tolerance: autoConvert(m.tolerance, nextUnit)
        }));
        return { ...prev, measurements: newMs, unit: nextUnit };
      });
    }
  };

  const handleLineSheetLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploadingLogo(true);
    try {
      const userId = packData?.userId || auth.currentUser?.uid || 'shared_user';
      const downloadUrl = await uploadGarmentImage(file, userId);

      const packRef = doc(db, 'techPacks', id);
      await updateDoc(packRef, {
        'techPack.properties.wovnLogo': downloadUrl,
        updatedAt: serverTimestamp()
      });

      setData((prev: any) => ({
        ...prev,
        properties: {
          ...(prev?.properties || {}),
          wovnLogo: downloadUrl
        }
      }));
    } catch (err) {
      console.error("Failed uploading line sheet logo:", err);
      alert("Failed to upload logo image. Please try another image file.");
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleRemoveLineSheetLogo = async () => {
    if (!id) return;
    try {
      const packRef = doc(db, 'techPacks', id);
      await updateDoc(packRef, {
        'techPack.properties.wovnLogo': '',
        updatedAt: serverTimestamp()
      });
      setData((prev: any) => ({
        ...prev,
        properties: {
          ...(prev?.properties || {}),
          wovnLogo: ''
        }
      }));
    } catch (err) {
      console.error("Failed removing line sheet logo:", err);
    }
  };

  const handleSaveBrandText = async () => {
    if (!id) return;
    try {
      const packRef = doc(db, 'techPacks', id);
      const newName = brandNameInput.trim() || 'WOV/N';
      const newSubtitle = brandSubtitleInput.trim() || 'Design Studio';
      await updateDoc(packRef, {
        'techPack.properties.brandName': newName,
        'techPack.properties.brandSubtitle': newSubtitle,
        updatedAt: serverTimestamp()
      });
      setData((prev: any) => ({
        ...prev,
        properties: {
          ...(prev?.properties || {}),
          brandName: newName,
          brandSubtitle: newSubtitle
        }
      }));
      setShowBrandTextModal(false);
    } catch (err) {
      console.error("Failed saving brand text:", err);
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
           height: 3.8in !important;
           margin: 0 auto;
           overflow: hidden;
        }
        .print-properties-grid {
           display: grid !important;
           grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        }
        table {
           width: 100% !important;
           table-layout: fixed;
           word-wrap: break-word;
        }
        th, td {
           white-space: normal !important;
           word-break: break-word;
        }
        .page-break-avoid {
           page-break-inside: avoid;
           break-inside: avoid;
        }
        .print-force-new-page {
           page-break-before: always !important;
           break-before: page !important;
           margin-top: 0 !important;
        }
      }
    `
  });

  const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

  const displayData = activeLanguage !== 'English' && data?.translations?.[activeLanguage]
    ? data.translations[activeLanguage]
    : data;

  const isImgHidden = (url: string) => {
    if (!url) return false;
    return hiddenGalleryImages.includes(url) || hiddenGalleryImages.some(h => h && (h === url || decodeURIComponent(h) === decodeURIComponent(url)));
  };

  const getBOMList = (source: any = displayData) => {
    if (Array.isArray(source?.bom)) return source.bom;
    if (Array.isArray(source?.fabrication)) return source.fabrication;
    return [];
  };

  const bomList = getBOMList(displayData);

  const ensureDetailModules = () => {
    if (!displayData) return [];
    let mods = displayData.detailModules;
    if (!mods) {
      if (displayData.detailImage || (displayData.details && displayData.details.length > 0)) {
        mods = [{
          title: 'Detail Closeups',
          subtitle: 'Hardware & Stitching Details',
          detailImage: displayData.detailImage || '',
          details: displayData.details || []
        }];
      } else {
        mods = [];
      }
    }
    return mods.map((mod: any) => {
      const allImages: string[] = mod.images || (mod.detailImage ? [mod.detailImage] : []);
      const visibleImages = allImages.filter((img: string) => !isImgHidden(img));
      return {
        ...mod,
        images: visibleImages,
        detailImage: visibleImages[0] || ''
      };
    });
  };

  const dModules = ensureDetailModules();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-600">Loading Tech Pack Specification...</p>
      </div>
    );
  }

  if (!packData || !data) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4 border border-gray-200">
          <FileText size={32} />
        </div>
        <h1 className="text-2xl font-serif font-bold text-gray-900 mb-2">Tech Pack Unavailable</h1>
        <p className="text-sm text-gray-500 max-w-md">
          This tech pack may have been removed, made private, or the link may be incorrect.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-gray-900 py-6 px-3 sm:px-6 lg:px-8">
      <div className="max-w-[1300px] mx-auto space-y-5">
        
        {/* Isolated Read-Only Top Navigation Bar */}
        <header className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-sm p-4 print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
              TP
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-serif font-bold text-gray-900 truncate">
                  {packName}
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200 shrink-0">
                  <Eye size={10} />
                  Read-Only
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">
                Garment Technical Specifications & Factory Package
              </p>
            </div>
          </div>

          {/* Viewer Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('techpack')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'techpack' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Tech Pack
              </button>
              <button
                onClick={() => setViewMode('linesheet')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'linesheet' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Line Sheet
              </button>
            </div>

            {/* Unit Toggle */}
            <button
              onClick={toggleUnit}
              className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
              title="Switch Measurement Units"
            >
              <span>Unit:</span>
              <span className="text-black uppercase">{globalUnit === 'in' ? 'Inches' : 'CM'}</span>
            </button>

            {/* Language selector if translations exist */}
            {data.translations && Object.keys(data.translations).length > 0 && (
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-700 shadow-sm">
                <span className="text-[10px] text-gray-400">LANG:</span>
                <select
                  value={activeLanguage}
                  onChange={(e) => setActiveLanguage(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer"
                >
                  <option value="English">English</option>
                  {Object.keys(data.translations).map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Export / Print PDF Button */}
            <Button
              onClick={handleExport}
              className="px-4 py-2 bg-black text-white hover:bg-gray-800 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>Export PDF</span>
            </Button>
          </div>
        </header>

        {/* Main Document Body */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm relative">
          <div ref={exportRef} className="p-4 sm:p-8 md:p-10 w-full bg-white text-gray-900 print-container max-w-full overflow-x-hidden">
            
            {/* Document Header */}
            <header className="border-b border-gray-200 pb-2 mb-3 flex justify-between items-end">
              <div>
                <h1 className="text-2xl sm:text-3xl font-serif font-extrabold tracking-tight leading-none uppercase">
                  {packName ? `${packName} - ` : ''}{viewMode === 'linesheet' ? 'LINE SHEET' : 'TECH PACK'}
                </h1>
                <div className="text-gray-500 font-sans font-medium tracking-widest text-[11px] uppercase mt-1">
                  {viewMode === 'linesheet' ? 'WHOLESALE SUMMARY' : 'GARMENT SPECIFICATION'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-500 text-xs print:text-[10px]">Date: {new Date().toLocaleDateString()}</div>
                <div className="text-gray-500 text-xs print:text-[10px] mt-0.5">
                  Ref: {displayData?.properties?.style || `TP-${id ? id.substring(0, 6) : '0001'}`}
                </div>
              </div>
            </header>

            {/* Properties Grid */}
            <div className="print-properties-grid grid grid-cols-2 md:grid-cols-8 gap-3 sm:gap-4 bg-gray-50 p-3.5 rounded-xl border border-gray-200 mb-5">
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Style Number</div>
                <div className="text-xs sm:text-sm font-semibold text-gray-900">{displayData?.properties?.style || 'N/A'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Season</div>
                <div className="text-xs sm:text-sm font-semibold text-gray-900">{displayData?.properties?.season || 'N/A'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Category</div>
                <div className="text-xs sm:text-sm font-semibold text-gray-900">{displayData?.properties?.category || 'N/A'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Occasion</div>
                <div className="text-xs sm:text-sm font-semibold text-gray-900">{displayData?.properties?.occasion || 'N/A'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Colors</div>
                <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate" title={displayData?.properties?.colorsText || 'N/A'}>
                  {displayData?.properties?.colorsText || 'N/A'}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Designer</div>
                <div className="text-xs sm:text-sm font-semibold text-gray-900">{displayData?.properties?.designer || 'N/A'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Gender</div>
                <div className="text-xs sm:text-sm font-semibold text-gray-900">{displayData?.properties?.gender || 'N/A'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Base Size</div>
                <div className="text-xs sm:text-sm font-bold text-black">{displayData?.properties?.baseSize || 'M'}</div>
              </div>
            </div>

            {viewMode === 'techpack' ? (
              <>
                {/* Tech Pack Core Section: Left Side Image & Gallery, Right Side Measurements */}
                <div className="grid grid-cols-12 gap-5 print:flex print:flex-col print:gap-0">
                  
                  {/* Left Column: Spec Image + Photo Gallery + Construction */}
                  <div className="col-span-12 lg:col-span-5 print:w-full space-y-5">
                    <div className="print:flex print:flex-row print:w-full print:gap-6 print:mb-4 print:pb-4 print:border-b print:border-gray-200">
                      <div className="w-full print:w-[55%] flex flex-col space-y-3">
                        
                        {/* Garment Spec Image with Callouts */}
                        <div className="bg-white rounded-2xl print-image-wrapper relative group/mainimg border border-gray-100 overflow-hidden shadow-sm">
                          {imageUrl ? (
                            <GarmentAnnotator
                              imageUrl={imageUrl}
                              measurements={displayData.measurements || []}
                              isLocked={true}
                              defaultGarmentType={displayData?.properties?.category || 'Garment'}
                              galleryImages={galleryImages}
                              onSelectImage={(img) => setImageUrl(img)}
                            />
                          ) : (
                            <div className="aspect-[4/5] bg-gray-50 flex flex-col items-center justify-center p-8 text-gray-400">
                              <FileText size={36} className="mb-2 opacity-50" />
                              <span className="text-xs font-semibold">No Image Uploaded</span>
                            </div>
                          )}

                          {/* Quick Lightbox Inspection Button */}
                          {imageUrl && (
                            <button
                              onClick={() => {
                                setLightboxImage(imageUrl);
                                setLightboxZoom(1);
                              }}
                              className="absolute top-3 right-3 bg-white/90 hover:bg-black hover:text-white text-gray-700 p-2 rounded-xl shadow-md backdrop-blur-sm transition-all opacity-0 group-hover/mainimg:opacity-100 print:hidden cursor-pointer"
                              title="Inspect Full Resolution"
                            >
                              <Maximize2 size={16} />
                            </button>
                          )}
                        </div>

                        {/* Complete Photo Gallery Strip */}
                        {galleryImages.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                                Garment Photos ({galleryImages.length})
                              </span>
                              <span className="text-[10px] text-gray-400">Click photo to inspect</span>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide py-1">
                              {galleryImages.map((gImg, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setImageUrl(gImg)}
                                  className={`group relative w-16 h-16 rounded-xl shrink-0 cursor-pointer overflow-hidden border-2 transition-all ${
                                    imageUrl === gImg
                                      ? 'border-black scale-105 shadow-md z-10'
                                      : 'border-transparent opacity-60 hover:opacity-100'
                                  }`}
                                >
                                  <img
                                    src={gImg}
                                    className="w-full h-full object-cover pointer-events-none"
                                    alt={`Garment photo ${idx + 1}`}
                                  />
                                  {idx === 0 && (
                                    <div className="absolute top-0 left-0 bg-black text-white text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg shadow-sm">
                                      MAIN
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLightboxImage(gImg);
                                      setLightboxZoom(1);
                                    }}
                                    className="absolute bottom-1 right-1 bg-white/90 hover:bg-black hover:text-white text-gray-700 w-5 h-5 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                    title="View Full Size"
                                  >
                                    <Maximize2 size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Color Swatches & Variations */}
                        {(() => {
                          let colorways: any[] = 
                            displayData?.properties?.dominantColorways || 
                            data?.properties?.dominantColorways || 
                            (packData as any)?.techPack?.properties?.dominantColorways || 
                            (packData as any)?.dominantColorways || 
                            [];

                          // Fallback to synthesize from colorsText if no array is stored
                          if ((!colorways || colorways.length === 0) && displayData?.properties?.colorsText) {
                            const raw = String(displayData.properties.colorsText).trim();
                            if (raw && raw !== 'N/A') {
                              colorways = raw.split(',').map((s: string) => s.trim()).filter(Boolean).map((name: string, i: number) => ({
                                id: `synth_${i}`,
                                name,
                                hex: COLOR_NAME_TO_HEX[name.toLowerCase()] || '#808080'
                              }));
                            }
                          }

                          if (!colorways || colorways.length === 0) return null;

                          return (
                            <div className="pt-2 border-t border-gray-100">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Palette size={12} className="text-gray-500" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                                  Color Swatches ({colorways.length})
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {colorways.map((cw: any, idx: number) => {
                                  const swatchColor = resolveHex(cw);
                                  return (
                                    <div
                                      key={cw.id || idx}
                                      className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50/80 hover:bg-white border border-gray-200/90 rounded-xl shadow-2xs transition-all"
                                      title={cw.name ? `${cw.name} (${swatchColor})` : swatchColor}
                                    >
                                      <span
                                        className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs block shrink-0"
                                        style={{ backgroundColor: swatchColor }}
                                      />
                                      <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">
                                        {cw.name || 'Color'}
                                      </span>
                                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider font-semibold">
                                        {swatchColor}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Print-Only Gallery Layout */}
                      <div className="hidden print:flex print:w-[45%] flex-col">
                        <h3 className="text-[10px] uppercase font-bold text-gray-500 mt-2 mb-3 border-t border-gray-200 pt-2 w-full text-center tracking-wider shrink-0">
                          Secondary Views
                        </h3>
                        {galleryImages.length > 1 && (
                          <div className="grid grid-cols-2 gap-3 flex-1 auto-rows-[1fr]">
                            {galleryImages.slice(1, 5).map((img, i) => (
                              <div key={i} className="bg-gray-50 rounded-2xl overflow-hidden flex items-center justify-center p-2 border border-gray-100">
                                <img src={img} className="max-w-full max-h-[1.7in] w-full object-contain pointer-events-none" alt="Secondary view" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Construction Details Section */}
                    <div className="bg-gray-50/60 rounded-2xl p-4 border border-gray-200/80">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-2">
                        <h3 className="text-base font-serif font-bold text-gray-900 leading-tight">
                          Construction Details
                        </h3>
                      </div>
                      <div className="text-xs text-gray-700 leading-relaxed">
                        {renderRichText(
                          typeof displayData.callouts === 'string'
                            ? displayData.callouts
                            : Array.isArray(displayData.callouts) && displayData.callouts.length > 0
                            ? displayData.callouts.map((c: any, i: number) => `${i + 1}. ${c.description || ''}`).join('\n')
                            : ''
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Measurements Table */}
                  <div className="col-span-12 lg:col-span-7 print:w-full space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
                        <h3 className="text-lg font-serif font-bold text-gray-900 leading-tight">
                          Measurements <span className="text-xs font-sans text-gray-400 font-normal">({globalUnit === 'in' ? 'inches' : 'cm'})</span>
                        </h3>
                        {/* Size Switcher Tabs */}
                        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
                          {SIZES.map((size) => (
                            <button
                              key={size}
                              onClick={() => setActiveSizeTab(size)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                activeSizeTab === size
                                  ? 'bg-white shadow-sm text-gray-900'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {size} {displayData?.properties?.baseSize === size ? '(Base)' : ''}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Measurements Table */}
                      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                        <table className="w-full text-xs text-left min-w-[500px]">
                          <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 border-b border-gray-200 tracking-wider">
                            <tr>
                              <th className="py-2.5 px-3 w-20 text-center font-bold">Dim ID</th>
                              <th className="py-2.5 px-3 font-bold">Point of Measure</th>
                              <th className="py-2.5 px-3 w-28 text-center font-bold">Tolerance (+/-)</th>
                              <th className="py-2.5 px-3 w-24 text-center font-bold bg-gray-100/70 text-black">
                                {activeSizeTab} {activeSizeTab === (displayData?.properties?.baseSize || 'M') ? '(Base)' : ''}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(displayData.measurements || []).map((m: any, index: number) => {
                              const baseSize = displayData?.properties?.baseSize || 'M';
                              const displayVal = activeSizeTab === baseSize
                                ? (m.value || '-')
                                : (m.sizes?.[activeSizeTab] || m.value || '-');
                              const displayTol = m.tolerance || (m.tolPlus ? `+${m.tolPlus} / -${m.tolMinus || m.tolPlus}` : '0.5');

                              return (
                                <tr key={m.id || index} className="hover:bg-gray-50/70 transition-colors">
                                  <td className="py-2 px-3 text-center font-bold text-gray-400">
                                    {m.id || index + 1}
                                  </td>
                                  <td className="py-2 px-3 font-medium text-gray-800">
                                    {m.name || m.description || 'Measurement Point'}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono text-gray-500">
                                    {displayTol}
                                  </td>
                                  <td className="py-2 px-3 text-center font-bold font-mono text-gray-900 bg-gray-50/50">
                                    {displayVal}
                                  </td>
                                </tr>
                              );
                            })}
                            {(!displayData.measurements || displayData.measurements.length === 0) && (
                              <tr>
                                <td colSpan={4} className="py-6 text-center text-gray-400 italic">
                                  No measurements specified.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Bill of Materials (BOM) Section */}
                    {bomList.length > 0 && (
                      <div className="space-y-2 pt-3">
                        <h3 className="text-base font-serif font-bold text-gray-900 leading-tight">
                          Bill of Materials (BOM)
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                          <table className="w-full text-xs text-left min-w-[500px]">
                            <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 border-b border-gray-200 tracking-wider">
                              <tr>
                                <th className="py-2 px-3 font-bold w-28">Category</th>
                                <th className="py-2 px-3 font-bold">Component</th>
                                <th className="py-2 px-3 font-bold">Positioning</th>
                                <th className="py-2 px-3 font-bold">Comment / Notes</th>
                                <th className="py-2 px-3 font-bold">Supplier</th>
                                <th className="py-2 px-2 font-bold text-center w-14">Photo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {bomList.map((b: any, bIdx: number) => {
                                const photo = b.image && !isImgHidden(b.image) ? b.image : null;
                                return (
                                  <tr key={bIdx} className="hover:bg-gray-50/70 transition-colors">
                                    <td className="py-2 px-3 font-medium uppercase text-[11px] text-gray-500 tracking-wide align-top">
                                      {b.category || 'Fabric'}
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-gray-900 align-top">
                                      {b.component || b.material || b.item || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-gray-700 align-top">
                                      {b.positioning || b.placement || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-gray-700 align-top">
                                      {b.comment || b.notes || b.composition || '-'}
                                    </td>
                                    <td className="py-2 px-3 text-gray-600 align-top">
                                      {b.supplier || '-'}
                                    </td>
                                    <td className="py-2 px-2 text-center align-middle">
                                      {photo ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setLightboxImage(photo);
                                            setLightboxZoom(1);
                                          }}
                                          className="inline-flex items-center justify-center p-0.5 rounded border border-gray-200 hover:border-black bg-white transition-all cursor-pointer group shadow-2xs"
                                          title="View BOM item photo"
                                        >
                                          <img
                                            src={photo}
                                            alt={b.component || 'BOM Item'}
                                            className="w-7 h-7 object-cover rounded group-hover:scale-105 transition-transform"
                                          />
                                        </button>
                                      ) : (
                                        <span className="text-gray-300 font-mono text-xs">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detail Closeups & Modules Section */}
                {dModules.length > 0 && (
                  <div className="space-y-6 pt-6 border-t border-gray-200 mt-6 print-force-new-page">
                    <div className="border-b border-gray-200 pb-2">
                      <h2 className="text-xl font-serif font-bold text-gray-900">
                        Garment Detail Closeups & Specifications
                      </h2>
                    </div>

                    <div className="space-y-8">
                      {dModules.map((mod: any, mIdx: number) => {
                        const images: string[] = mod.images || (mod.detailImage ? [mod.detailImage] : []);
                        return (
                          <div key={mIdx} className="grid grid-cols-12 gap-5 bg-gray-50/60 p-4 rounded-2xl border border-gray-200">
                            {/* Detail Module Images */}
                            <div className="col-span-12 lg:col-span-6 space-y-3">
                              {images.length > 0 ? (
                                <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                                  <DetailAnnotator
                                    images={images}
                                    details={mod.details || []}
                                    onUpdateDetail={() => {}}
                                    isLocked={true}
                                  />
                                </div>
                              ) : (
                                <div className="aspect-[4/3] bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-xs font-semibold">
                                  No closeup photos uploaded
                                </div>
                              )}
                            </div>

                            {/* Detail Module Callouts List */}
                            <div className="col-span-12 lg:col-span-6 space-y-3">
                              <div>
                                <h4 className="text-base font-serif font-bold text-gray-900">{mod.title || 'Detail Section'}</h4>
                                {mod.subtitle && <p className="text-xs text-gray-500">{mod.subtitle}</p>}
                              </div>

                              <div className="space-y-2.5">
                                {(mod.details || []).map((detail: any, dIdx: number) => (
                                  <div key={dIdx} className="flex gap-3 bg-white p-3 rounded-xl border border-gray-200/80 shadow-xs">
                                    <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                      {detail.id || dIdx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-gray-800 leading-relaxed font-medium">
                                        {detail.description || 'No detail description'}
                                      </div>
                                      {detail.iconUrl && (
                                        <div className="mt-2 flex items-center gap-2">
                                          <div className="w-8 h-6 bg-gray-50 border border-gray-200 rounded p-0.5">
                                            <img src={detail.iconUrl} className="w-full h-full object-contain" alt="Seam icon" />
                                          </div>
                                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Seam Spec</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {(!mod.details || mod.details.length === 0) && (
                                  <p className="text-xs text-gray-400 italic">No specific callout notes for this section.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Colorways Section */}
                {(() => {
                  let colorways: any[] = 
                    displayData?.properties?.dominantColorways || 
                    data?.properties?.dominantColorways || 
                    (packData as any)?.techPack?.properties?.dominantColorways || 
                    (packData as any)?.dominantColorways || 
                    [];

                  if ((!colorways || colorways.length === 0) && displayData?.properties?.colorsText) {
                    const raw = String(displayData.properties.colorsText).trim();
                    if (raw && raw !== 'N/A') {
                      colorways = raw.split(',').map(s => s.trim()).filter(Boolean).map((name: string, i: number) => ({
                        id: `synth_${i}`,
                        name,
                        hex: COLOR_NAME_TO_HEX[name.toLowerCase()] || '#808080'
                      }));
                    }
                  }

                  if (!colorways || colorways.length === 0) return null;

                  return (
                    <div className="pt-6 border-t border-gray-200 mt-6 page-break-avoid">
                      <h3 className="text-base font-serif font-bold text-gray-900 mb-3">
                        Colorways & Swatches
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {colorways.map((cw: any, cwIdx: number) => {
                          const swatchColor = resolveHex(cw);
                          return (
                            <div key={cwIdx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-2 text-center">
                              <div
                                className="w-10 h-10 rounded-full border border-black/15 shadow-xs"
                                style={{ backgroundColor: swatchColor }}
                              />
                              <span className="text-xs font-bold text-gray-900 truncate w-full">{cw.name || 'Color'}</span>
                              <span className="text-[10px] font-mono text-gray-400 uppercase">{swatchColor}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              /* Wholesale Line Sheet Mode */
              <div className="py-4">
                <div className="w-[8.5in] max-w-full mx-auto bg-white border border-gray-200 rounded-3xl p-8 sm:p-10 shadow-sm min-h-[9in] flex flex-col justify-between">
                  <div className="flex-1">
                    <header className="grid grid-cols-3 items-start mb-8">
                      <div className="flex flex-col text-left">
                        <span className="text-2xl font-serif uppercase font-bold leading-none mb-1 text-gray-900">
                          {displayData?.properties?.season || 'COLLECTION'}
                        </span>
                        <span className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                          {displayData?.properties?.category || 'WHOLESALE SUMMARY'}
                        </span>
                      </div>
                      {/* Center Brand / Studio Logo Area */}
                      <div className="flex flex-col items-center justify-center -mt-2 group relative">
                        {displayData?.properties?.wovnLogo ? (
                          <div className="relative flex items-center justify-center py-1">
                            <img
                              src={displayData.properties.wovnLogo}
                              alt={displayData?.properties?.brandName || 'Brand Logo'}
                              className="h-16 sm:h-20 max-w-[240px] object-contain"
                            />
                            {/* Remove button on hover */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRemoveLineSheetLogo();
                              }}
                              className="absolute -top-2 -right-6 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity print:hidden z-10 p-1 bg-white rounded-full shadow-md border border-gray-200 cursor-pointer"
                              title="Remove custom logo"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center">
                            <div className="text-4xl sm:text-5xl font-serif tracking-widest font-black text-black leading-none">
                              {displayData?.properties?.brandName || 'WOV/N'}
                            </div>
                            <div className="text-[10px] tracking-[0.4em] font-medium text-gray-500 mt-1 uppercase">
                              {displayData?.properties?.brandSubtitle || 'Design Studio'}
                            </div>
                          </div>
                        )}

                        {/* Interactive Logo Controls (Visible on hover in browser, hidden when printed) */}
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-xs opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity print:hidden rounded-xl border border-dashed border-gray-300 shadow-sm p-2 z-20">
                          {isUploadingLogo ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                              <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                              <span>Uploading Logo...</span>
                            </div>
                          ) : (
                            <>
                              <label
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 text-[10px] font-bold uppercase tracking-wider cursor-pointer shadow-sm transition-all"
                                title="Upload a custom logo image"
                              >
                                <Upload size={11} />
                                <span>{displayData?.properties?.wovnLogo ? 'Change Image' : 'Upload Logo'}</span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  disabled={isUploadingLogo}
                                  onChange={handleLineSheetLogoUpload}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setBrandNameInput(displayData?.properties?.brandName || 'WOV/N');
                                  setBrandSubtitleInput(displayData?.properties?.brandSubtitle || 'Design Studio');
                                  setShowBrandTextModal(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-gray-200 shadow-2xs transition-all"
                                title="Edit brand name & subtitle text"
                              >
                                <Edit3 size={11} />
                                <span>Edit Text</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Header Column (Client Logo & Ref) */}
                      <div className="flex items-center justify-end gap-3">
                        {displayData?.properties?.clientLogo && (
                          <img
                            src={displayData.properties.clientLogo}
                            alt="Client Logo"
                            className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                          />
                        )}
                        <div className="text-right">
                          <div className="text-xs font-bold text-gray-900">REF: {displayData?.properties?.style || 'TP-001'}</div>
                          <div className="text-[10px] text-gray-400">{new Date().toLocaleDateString()}</div>
                        </div>
                      </div>
                    </header>

                    {/* Line Sheet Garment Photo */}
                    <div className="w-full flex justify-center mb-8">
                      {displayData?.lineSheetImage && !isImgHidden(displayData.lineSheetImage) ? (
                        <div className="w-[85%] max-w-[500px] aspect-[4/5] rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center p-4">
                          <img src={displayData.lineSheetImage} alt={packName} className="w-full h-full object-contain" />
                        </div>
                      ) : imageUrl ? (
                        <div className="w-[85%] max-w-[500px] aspect-[4/5] rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center p-4">
                          <img src={imageUrl} alt={packName} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-[85%] max-w-[500px] aspect-[4/5] bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
                          No Photo Available
                        </div>
                      )}
                    </div>

                    {/* Wholesale Specs Grid */}
                    <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Garment</span>
                        <span className="text-xs font-bold text-gray-900">{packName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Category</span>
                        <span className="text-xs font-bold text-gray-900">{displayData?.properties?.category || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Colors</span>
                        <span className="text-xs font-bold text-gray-900">{displayData?.properties?.colorsText || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Available Sizes</span>
                        <span className="text-xs font-bold text-gray-900">XS - 3XL</span>
                      </div>
                    </div>

                    {/* Line Sheet Swatches */}
                    {(() => {
                      let colorways: any[] = 
                        displayData?.properties?.dominantColorways || 
                        data?.properties?.dominantColorways || 
                        (packData as any)?.techPack?.properties?.dominantColorways || 
                        (packData as any)?.dominantColorways || 
                        [];

                      if ((!colorways || colorways.length === 0) && displayData?.properties?.colorsText) {
                        const raw = String(displayData.properties.colorsText).trim();
                        if (raw && raw !== 'N/A') {
                          colorways = raw.split(',').map(s => s.trim()).filter(Boolean).map((name: string, i: number) => ({
                            id: `synth_${i}`,
                            name,
                            hex: COLOR_NAME_TO_HEX[name.toLowerCase()] || '#808080'
                          }));
                        }
                      }

                      if (!colorways || colorways.length === 0) return null;

                      return (
                        <div className="mt-4 p-3.5 bg-gray-50/70 border border-gray-200 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block mb-2 text-center sm:text-left">
                            Available Colorways ({colorways.length})
                          </span>
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            {colorways.map((cw: any, idx: number) => {
                              const swatchColor = resolveHex(cw);
                              return (
                                <div
                                  key={cw.id || idx}
                                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-lg shadow-2xs"
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-2xs block shrink-0"
                                    style={{ backgroundColor: swatchColor }}
                                  />
                                  <span className="text-xs font-semibold text-gray-900">{cw.name || 'Color'}</span>
                                  <span className="text-[10px] font-mono text-gray-400 uppercase">{swatchColor}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Brand Text Customization Modal */}
      <AnimatePresence>
        {showBrandTextModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Edit Line Sheet Branding</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Customize the brand title and studio subtitle.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBrandTextModal(false)}
                  className="p-1.5 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={brandNameInput}
                    onChange={(e) => setBrandNameInput(e.target.value)}
                    placeholder="e.g. WOV/N, CATALYST, ACME"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Subtitle / Studio
                  </label>
                  <input
                    type="text"
                    value={brandSubtitleInput}
                    onChange={(e) => setBrandSubtitleInput(e.target.value)}
                    placeholder="e.g. Design Studio, Apparel Co., Studio 01"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBrandTextModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-black rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleSaveBrandText}
                  className="px-4 py-1.5 bg-black text-white hover:bg-gray-800 text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Save Branding
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive High-Resolution Photo Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-5xl w-full max-h-[92vh] flex flex-col items-center justify-center"
            >
              {/* Lightbox Controls */}
              <div className="absolute top-0 right-0 left-0 flex items-center justify-between p-4 z-20">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 text-white text-xs font-bold">
                  <span>Photo Inspector</span>
                  <span className="text-white/50">•</span>
                  <span className="text-white/80">{Math.round(lightboxZoom * 100)}%</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLightboxZoom(prev => Math.max(0.5, prev - 0.25))}
                    className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-white border border-white/10 backdrop-blur-sm transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <button
                    onClick={() => setLightboxZoom(prev => Math.min(3, prev + 0.25))}
                    className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-white border border-white/10 backdrop-blur-sm transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    onClick={() => setLightboxZoom(1)}
                    className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-white border border-white/10 backdrop-blur-sm transition-colors cursor-pointer"
                    title="Reset Zoom"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={() => forceDownload(lightboxImage, `${packName.replace(/\s+/g, '_')}_photo.png`)}
                    className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-white border border-white/10 backdrop-blur-sm transition-colors cursor-pointer"
                    title="Download Photo"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => setLightboxImage(null)}
                    className="p-2 rounded-xl bg-white text-black hover:bg-gray-200 transition-colors cursor-pointer ml-2"
                    title="Close Inspector"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Photo Image Display */}
              <div className="overflow-auto max-h-[80vh] max-w-full flex items-center justify-center p-4">
                <img
                  src={lightboxImage}
                  alt="High-resolution garment photo"
                  className="max-h-[75vh] w-auto object-contain transition-transform duration-200 rounded-lg shadow-2xl"
                  style={{ transform: `scale(${lightboxZoom})` }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
