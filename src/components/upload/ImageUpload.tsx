import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, X } from 'lucide-react';

interface ImageUploadProps {
  onImageSelected: (file: File, dataUrl: string) => void;
}

export function ImageUpload({ onImageSelected }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      onImageSelected(file, result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [onImageSelected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearImage = () => {
    setPreview(null);
  };

  return (
    <div className="w-full">
      {!preview ? (
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center w-full h-80 rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden ${
            isDragging 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-white/10 bg-black/20 hover:border-white/30 hover:bg-black/40'
          }`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
            <Upload className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="mb-2 text-sm text-gray-300">
              <span className="font-semibold text-blue-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">PNG, JPG or WEBP (MAX. 5MB)</p>
          </div>
        </motion.div>
      ) : (
        <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 group">
          <img src={preview} alt="Upload preview" className="w-full h-auto max-h-[600px] object-contain bg-black/40" />
          <button
            onClick={clearImage}
            className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-red-500/80 backdrop-blur text-white rounded-full transition-all opacity-0 group-hover:opacity-100 shadow-xl"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
