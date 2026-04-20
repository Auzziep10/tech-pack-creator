import React from 'react';
import { Box, Download, Smartphone } from 'lucide-react';

export const Garment3DViewer = ({ url }: { url: string }) => {
  if (!url) return null;

  return (
    <div className="w-full h-full min-h-[300px] bg-gradient-to-b from-gray-50 to-gray-200 rounded-2xl overflow-hidden relative border border-gray-200 flex flex-col items-center justify-center p-8">
      <div className="w-20 h-20 bg-white shadow-md rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
        <Box size={40} className="text-blue-500" />
      </div>
      
      <h3 className="text-xl font-bold text-gray-900 mb-2">3D Garment Mesh</h3>
      <p className="text-sm text-gray-500 text-center max-w-[280px] mb-6">
        This high-fidelity topographic mesh was captured via LiDAR.
      </p>
      
      <div className="flex flex-col gap-3 w-full max-w-[200px]">
        <a 
          href={url} 
          rel="ar"
          className="flex items-center justify-center gap-2 bg-black text-white hover:bg-gray-800 py-3 px-4 rounded-xl font-bold transition-colors w-full"
        >
          <Smartphone size={18} />
          View in AR / 3D
        </a>
        
        <a 
          href={url} 
          download
          className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 py-3 px-4 rounded-xl font-bold transition-colors w-full"
        >
          <Download size={18} />
          Download .USDZ
        </a>
      </div>
      
      <div className="absolute bottom-4 text-center text-[10px] font-bold tracking-wider text-gray-400 uppercase w-full">
        APPLE QUICK LOOK FORMAT
      </div>
    </div>
  );
};
