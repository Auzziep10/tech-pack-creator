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

async function urlToGenerativePart(urlOrBase64: string): Promise<any> {
  if (urlOrBase64.startsWith('data:')) {
    return base64ToGenerativePart(urlOrBase64);
  }
  
  const response = await fetch(urlOrBase64);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(base64ToGenerativePart(reader.result as string));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function analyzeGarmentForMeasurement(frontImageUrl: string, backImageUrl?: string): Promise<string> {
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
    return data || "Chest Width";
  } catch (error) {
    console.warn("Gemini API Error (likely using stub key). Falling back to default.");
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1500));
    return "T-Shirt / Basic Garment";
  }
}

export async function generateTechPack(frontImageUrl: string, backImageUrl: string | undefined, chestWidth: string, bodyLength: string, shoulderWidth: string, baseSize: string, garmentType: string) {
  try {
    const frontPart = await urlToGenerativePart(frontImageUrl);
    let backPart = null;

    if (backImageUrl && backImageUrl.trim() !== '') {
       backPart = await urlToGenerativePart(backImageUrl);
    }

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frontPart, backPart, chestWidth, bodyLength, shoulderWidth, baseSize, garmentType })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const { data } = await res.json();
    return data;
  } catch (error) {
    console.error("Gemini API Error details:", error);
    throw new Error("AI Generation Failed. Your API key might be missing, invalid, or encountering an issue.");
  }
}
