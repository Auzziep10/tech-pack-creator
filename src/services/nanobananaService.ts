async function resizeImage(imageUrl: string, maxSize = 1440): Promise<{ base64Data: string, mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas null'));
      // Keep it pristine white on transparent just in case
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) resolve({ mimeType: match[1], base64Data: match[2] });
      else reject(new Error("Failed to parse data URL"));
    };
    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = imageUrl;
  });
}

export async function vectorizeGarmentImage(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas null'));
      
      // Provide a clean white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Apply professional technical CAD filter programmatically onto the raster image
      ctx.filter = 'grayscale(100%) contrast(125%) brightness(110%) sepia(10%) hue-rotate(180deg)';
      ctx.drawImage(img, 0, 0, img.width, img.height);
      
      // Ensure we export exactly as a pure image rather than a fragile text SVG
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error("Failed to load image for blueprint generation"));
    img.src = imageUrl;
  });
}
