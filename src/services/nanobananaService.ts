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
      // 1. Setup Canvas for Edge Tracing
      const canvas = document.createElement('canvas');
      const width = img.width;
      const height = img.height;
      
      // Limit resolution to prevent browser freeze on massive images
      const MAX_SIDE = 1000;
      let drawWidth = width;
      let drawHeight = height;
      if (width > MAX_SIDE || height > MAX_SIDE) {
        if (width > height) {
          drawHeight = Math.round((height * MAX_SIDE) / width);
          drawWidth = MAX_SIDE;
        } else {
          drawWidth = Math.round((width * MAX_SIDE) / height);
          drawHeight = MAX_SIDE;
        }
      }
      
      canvas.width = drawWidth;
      canvas.height = drawHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context null'));
      
      // Clean background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, drawWidth, drawHeight);
      
      // Enhance contrast and remove color BEFORE edge detection for cleaner lines
      ctx.filter = 'grayscale(100%) contrast(150%)';
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      
      // 2. Extract ImageData
      const imgData = ctx.getImageData(0, 0, drawWidth, drawHeight);
      const outputData = ctx.createImageData(drawWidth, drawHeight);
      const data = imgData.data;
      const out = outputData.data;
      
      // 3. Sobel Operator Kernels for Edge Tracing
      const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
      
      for (let y = 0; y < drawHeight; y++) {
        for (let x = 0; x < drawWidth; x++) {
          const pixelOffset = (y * drawWidth + x) * 4;
          
          let pixelX = 0;
          let pixelY = 0;
          
          // Apply Convolution
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const ny = Math.min(Math.max(y + ky, 0), drawHeight - 1);
              const nx = Math.min(Math.max(x + kx, 0), drawWidth - 1);
              const nOffset = (ny * drawWidth + nx) * 4;
              const weightIndex = (ky + 1) * 3 + (kx + 1);
              
              // Only need one channel since image is grayscale
              const val = data[nOffset]; 
              pixelX += val * kernelX[weightIndex];
              pixelY += val * kernelY[weightIndex];
            }
          }
          
          // Calculate gradient magnitude
          let magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
          
          // Threshold formatting: Sharp black lines on crisp white background
          magnitude = magnitude > 60 ? 0 : 255; 
          
          out[pixelOffset] = magnitude;     // R
          out[pixelOffset + 1] = magnitude; // G
          out[pixelOffset + 2] = magnitude; // B
          out[pixelOffset + 3] = 255;       // Alpha
        }
      }
      
      // 4. Render extracted CAD lines
      ctx.putImageData(outputData, 0, 0);
      
      // Optionally apply subtle blueprint blue tint
      // ctx.globalCompositeOperation = 'multiply';
      // ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      // ctx.fillRect(0, 0, drawWidth, drawHeight);
      
      const dataUrl = canvas.toDataURL('image/png', 0.9);
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error("Failed to load image for geometric edge-tracing"));
    img.src = imageUrl;
  });
}
