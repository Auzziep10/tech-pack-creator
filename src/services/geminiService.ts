function base64ToGenerativePart(dataUrl: string) {
  const base64Data = dataUrl.split(',')[1];
  const mimeType = dataUrl.split(';')[0].split(':')[1];
  return {
    inlineData: {
      data: base64Data,
      mimeType
    },
  };
}

async function urlToGenerativePart(urlOrBase64: string, maxSize = 1440): Promise<any> {
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
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        resolve({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      } else reject(new Error("Failed to parse data URL"));
    };
    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = urlOrBase64;
  });
}

export async function analyzeGarmentForMeasurement(frontImageUrl: string, backImageUrl?: string): Promise<{ type: string, anchors: { id: string, label: string, description: string }[] }> {
  try {
    const frontPart = await urlToGenerativePart(frontImageUrl);
    let backPart = null;

    if (backImageUrl && backImageUrl.trim() !== '') {
       backPart = await urlToGenerativePart(backImageUrl);
    }

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frontPart, backPart })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const { data } = await res.json();
    return data || { 
      type: "T-Shirt / Basic Garment", 
      anchors: [{id: 'chest', label: 'Chest Width (cm)', description: ''}, {id: 'length', label: 'Body Length (cm)', description: ''}] 
    };
  } catch (error) {
    console.warn("Gemini API Error (likely using stub key). Falling back to default.");
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1500));
    return { 
      type: "T-Shirt / Basic Garment", 
      anchors: [
        { id: 'chest', label: 'Chest Width (cm)', description: 'Measure across the chest' },
        { id: 'length', label: 'Body Length (cm)', description: 'Measure from highest point of shoulder to hem' }
      ] 
    };
  }
}

export async function generateTechPack(frontImageUrl: string, backImageUrl: string | undefined, anchors: any[], anchorValues: Record<string, string>, baseSize: string, garmentType: string, wovnMetadata?: any) {
  try {
    const frontPart = await urlToGenerativePart(frontImageUrl);
    let backPart = null;

    if (backImageUrl && backImageUrl.trim() !== '') {
       backPart = await urlToGenerativePart(backImageUrl);
    }

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frontPart, backPart, anchors, anchorValues, baseSize, garmentType, wovnMetadata })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const { data } = await res.json();
    return data;
  } catch (error: any) {
    console.error("Gemini API Error details:", error);
    throw new Error(error.message || "Generation Failed due to an unknown issue.");
  }
}

export async function gradeSize(measurements: any[], baseSize: string, targetSize: string, garmentType: string) {
  try {
    const res = await fetch('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ measurements, baseSize, targetSize, garmentType })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const { data } = await res.json();
    return data;
  } catch (error: any) {
    console.error("Gemini Grading Error:", error);
    throw new Error(error.message || "Grading Failed due to an unknown issue.");
  }
}

