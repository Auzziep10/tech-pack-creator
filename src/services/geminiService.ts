import { GoogleGenerativeAI } from '@google/generative-ai';

// In a real app, this would be injected via environment variables or backend
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIza-stubbed-key-for-local-dev';
const genAI = new GoogleGenerativeAI(API_KEY);

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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const frontPart = await urlToGenerativePart(frontImageUrl);
    
    const prompt = `You are an expert technical apparel designer.
Analyze this garment mockup. 
What is the specific type and style of this garment? (e.g., "Drop-Hem Short Sleeve T-Shirt", "Oversized Hoodie", "Crewneck Sweater").
Respond ONLY with the crisp name of the garment style, nothing else.`;

    const parts: any[] = [prompt, frontPart];
    if (backImageUrl && backImageUrl.trim() !== '') {
       const backPart = await urlToGenerativePart(backImageUrl);
       parts.push("\n\nThe following is the BACK side of the garment:");
       parts.push(backPart);
    }

    const result = await model.generateContent(parts);
    const response = result.response.text().trim();
    return response || "Chest Width";
  } catch (error) {
    console.warn("Gemini API Error (likely using stub key). Falling back to default.");
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1500));
    return "T-Shirt / Basic Garment";
  }
}

export async function generateTechPack(frontImageUrl: string, backImageUrl: string | undefined, chestWidth: string, bodyLength: string, shoulderWidth: string, baseSize: string, garmentType: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const frontPart = await urlToGenerativePart(frontImageUrl);
    
    const prompt = `You are an expert technical apparel designer.
Analyze this garment mockup. The AI previously classified it as a "${garmentType}".
To permanently eliminate camera lens distortion (where the top of the garment is closer to the lens than the bottom in flat-lays), the user has provided three precise geometric anchors for a size ${baseSize}:
- **Chest Width**: ${chestWidth}
- **Front Body Length (HPS to Hem)**: ${bodyLength}
- **Shoulder Hem (Seam to Seam)**: ${shoulderWidth}

Based on this image and these two exact architectural anchors, generate a complete Tech Pack in strict JSON format. Do not use markdown blocks, just raw JSON.
The JSON should have the following structure:
{
  "measurements": [
    { "point": "string", "description": "string", "value": "string (with units)", "tolerance": "string" }
  ],
  "callouts": [
    { "id": "number", "description": "string (construction details, stitching, hardware)" }
  ],
  "fabrication": [
    { "placement": "string", "material": "string", "weight": "string", "notes": "string" }
  ]
}

Carefully identify the specific style, silhouette, and features of the garment in the image.
Using the THREE provided geometric anchors, mathematically triangulate and scale the exact proportions of the remaining measurements (like neck drops, sleeve lengths, and armholes) to perfectly match the silhouette observed in the photo, completely voiding focal distortion from the camera tilt. 
Ensure the resultant measurements are mathematically realistic. Include at least 6 key measurements (including echoing the three anchors exactly as provided). CRITICAL: If the garment visually has a collar, you MUST recognize it and include precise collar dimensions (e.g., Collar Point Length, Collar Stand Height, Neck Drop, Neck Width) in the measurements. Include 4 explicit callouts describing hems/stitches, and 1-2 fabrication details.`;

    const parts: any[] = [prompt, frontPart];
    if (backImageUrl && backImageUrl.trim() !== '') {
       const backPart = await urlToGenerativePart(backImageUrl);
       parts.push("\n\nThe following is the BACK side of the garment:");
       parts.push(backPart);
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini API Error details:", error);
    throw new Error("AI Generation Failed. Your Gemini API key might be missing, invalid, or encountering an issue.");
  }
}
