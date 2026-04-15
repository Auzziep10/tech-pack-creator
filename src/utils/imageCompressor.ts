export const compressImageFile = async (file: File, maxWidth = 1600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        // Ensure max height is also reasonable to prevent vertical panoramas blowing up
        const maxHeight = 1600;
        if (height > maxHeight) {
           width = Math.round((width * maxHeight) / height);
           height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original if canvas fails
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress heavily to WebP to natively shrink PDFs (or JPEG fallback)
        // 0.8 is great quality but 10x smaller file size than raw PNG/JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
