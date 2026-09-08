export const compressImageFile = async (file: File, maxWidth = 2048): Promise<string> => {
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
        
        // Ensure max height is 2048px (2K ultra-sharp) for high-definition Gemini Vision & detail closeups
        const maxHeight = 2048;
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

        // Fill with white background to prevent transparent PNGs from turning black in JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // 2K Ultra-Sharp 90% JPEG quality for fine collar tags, stitching, and texture visibility
        const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
