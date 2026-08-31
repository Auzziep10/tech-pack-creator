async function resizeImage(imageUrl: string, maxSize = 2048): Promise<{ base64Data: string, mimeType: string }> {
  let targetSrc = imageUrl;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const resp = await fetch(imageUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        targetSrc = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      // Fallback to direct src if pre-fetch is blocked
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!targetSrc.startsWith('data:') && !targetSrc.startsWith('blob:')) {
      img.crossOrigin = 'Anonymous';
    }
    img.onload = () => {
      // Create temporary canvas to measure bounding box of garment subject
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) return reject(new Error('Canvas null'));

      tempCtx.drawImage(img, 0, 0);
      let data: Uint8ClampedArray | null = null;
      try {
        data = tempCtx.getImageData(0, 0, img.width, img.height).data;
      } catch (e) {
        // Fallback if crossOrigin restriction prevents getImageData
        data = null;
      }

      let cropX = 0, cropY = 0, cropW = img.width, cropH = img.height;

      if (data) {
        let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
        let foundSubject = false;

        // Sample pixels every 2px to find non-background bounds
        for (let y = 0; y < img.height; y += 2) {
          for (let x = 0; x < img.width; x += 2) {
            const idx = (y * img.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Check if pixel is NOT solid pure white/light-grey background (> 248 in RGB or transparent)
            const isBackground = (r > 248 && g > 248 && b > 248) || a < 20;
            if (!isBackground) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              foundSubject = true;
            }
          }
        }

        // If subject was detected with substantial background around it, crop tightly with 3% breathing margin
        if (foundSubject && (maxX - minX > 50) && (maxY - minY > 50)) {
          const marginX = Math.round((maxX - minX) * 0.03);
          const marginY = Math.round((maxY - minY) * 0.03);
          cropX = Math.max(0, minX - marginX);
          cropY = Math.max(0, minY - marginY);
          cropW = Math.min(img.width - cropX, (maxX - minX) + marginX * 2);
          cropH = Math.min(img.height - cropY, (maxY - minY) + marginY * 2);
        }
      }

      // Scale cropped bounds up to maxSize (2048px)
      let targetW = cropW;
      let targetH = cropH;
      if (targetW > maxSize || targetH > maxSize) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * maxSize) / targetW);
          targetW = maxSize;
        } else {
          targetW = Math.round((targetW * maxSize) / targetH);
          targetH = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas null'));

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) resolve({ mimeType: match[1], base64Data: match[2] });
      else reject(new Error("Failed to parse data URL"));
    };
    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = targetSrc;
  });
}

// Helper to crop out excess solid white/transparent padding from any image data URL or HTTP URL
export async function autoTrimWhitePadding(imageUrl: string): Promise<string> {
  let targetSrc = imageUrl;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const resp = await fetch(imageUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        targetSrc = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      // Fallback to direct src if fetch blocked
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    if (!targetSrc.startsWith('data:') && !targetSrc.startsWith('blob:')) {
      img.crossOrigin = 'Anonymous';
    }
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) return resolve(imageUrl);

      tempCtx.drawImage(img, 0, 0);
      let data: Uint8ClampedArray | null = null;
      try {
        data = tempCtx.getImageData(0, 0, img.width, img.height).data;
      } catch (e) {
        return resolve(imageUrl);
      }

      if (!data) return resolve(imageUrl);

      let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
      let foundSubject = false;

      // Sample pixels every 2px to locate non-background bounds
      for (let y = 0; y < img.height; y += 2) {
        for (let x = 0; x < img.width; x += 2) {
          const idx = (y * img.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          // Check if pixel is NOT background (RGB > 245 or alpha < 20)
          const isBackground = (r > 245 && g > 245 && b > 245) || a < 20;
          if (!isBackground) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            foundSubject = true;
          }
        }
      }

      if (!foundSubject || maxX <= minX || maxY <= minY) {
        return resolve(imageUrl);
      }

      // Add tight 2.5% breathing margin around subject
      const subjectW = maxX - minX;
      const subjectH = maxY - minY;
      const marginX = Math.round(subjectW * 0.025);
      const marginY = Math.round(subjectH * 0.025);

      const cropX = Math.max(0, minX - marginX);
      const cropY = Math.max(0, minY - marginY);
      const cropW = Math.min(img.width - cropX, subjectW + marginX * 2);
      const cropH = Math.min(img.height - cropY, subjectH + marginY * 2);

      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(imageUrl);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cropW, cropH);
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(imageUrl);
    img.src = targetSrc;
  });
}

export async function vectorizeGarmentImage(imageUrl: string): Promise<string> {
  try {
    const { base64Data, mimeType } = await resizeImage(imageUrl);

    const res = await fetch('/api/vectorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64Data, mimeType })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    return await autoTrimWhitePadding(data.data);

  } catch (err) {
    console.error("Vectorization Error:", err);
    throw err;
  }
}

export async function generateInvisibleMockup(imageUrl: string, garmentType: string, gender: string, viewPoint: string, fitStyle: string = 'Standard'): Promise<string> {
  try {
    const { base64Data, mimeType } = await resizeImage(imageUrl);

    const res = await fetch('/api/mannequin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64Data, mimeType, garmentType, gender, viewPoint, fitStyle })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    // Automatically trim excess white margins so mannequin is always full size
    return await autoTrimWhitePadding(data.data);

  } catch (err) {
    console.error("Invisible Mannequin Error:", err);
    throw err;
  }
}

export async function recolorGarmentImage(imageUrl: string, colorHex: string): Promise<string> {
  try {
    // Resize down to 1024px max dimension for faster AI recoloring turnaround
    const { base64Data, mimeType } = await resizeImage(imageUrl, 1024);

    const res = await fetch('/api/recolor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64Data, mimeType, colorHex })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    return await autoTrimWhitePadding(data.data);

  } catch (err) {
    console.error("Recoloring Error:", err);
    throw err;
  }
}

export async function expandMeasurements(imageUrl: string, existingMeasurements: any[], baseSize: string, garmentType: string, unit: string): Promise<any[]> {
  try {
    const { base64Data, mimeType } = await resizeImage(imageUrl);

    const res = await fetch('/api/expand-measurements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        frontPart: { inlineData: { data: base64Data, mimeType } },
        existingMeasurements,
        baseSize,
        garmentType,
        unit
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    return data.data?.newMeasurements || [];

  } catch (err) {
    console.error("Expand Measurements Error:", err);
    throw err;
  }
}

export async function generateCoreSpecs(imageUrl: string, garmentType: string, unit: string, baseSize: string): Promise<any[]> {
  try {
    const { base64Data, mimeType } = await resizeImage(imageUrl);

    const res = await fetch('/api/generate-core-specs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        frontPart: { inlineData: { data: base64Data, mimeType } },
        garmentType,
        unit,
        baseSize
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    return data.data?.coreMeasurements || [];

  } catch (err) {
    console.error("Generate Core Specs Error:", err);
    throw err;
  }
}

export async function clarifyMeasurements(measurements: any[], garmentType: string): Promise<any[]> {
  try {
    const res = await fetch('/api/clarify-measurements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        measurements,
        garmentType
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    return data.data || [];

  } catch (err) {
    console.error("Clarify Measurements Error:", err);
    throw err;
  }
}

export async function eraseBrandingRegion(imageUrl: string, maskBase64: string): Promise<string> {
  try {
    const { base64Data, mimeType } = await resizeImage(imageUrl);

    const res = await fetch('/api/erase-branding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64Data, mimeType, maskBase64, maskMimeType: 'image/png' })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    return await autoTrimWhitePadding(data.data);

  } catch (err) {
    console.error("Erase Branding Error:", err);
    throw err;
  }
}
