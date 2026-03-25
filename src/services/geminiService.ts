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
The JSON should have the exact following structure matching our official Tech Pack template guidelines:
{
  "properties": {
    "style": "string (e.g., 200021-CL)",
    "externalStyleName": "string",
    "season": "string (e.g., FW25)",
    "concept": "string",
    "gender": "string",
    "category": "string",
    "description": "string",
    "pd": "string",
    "td": "string",
    "designer": "string"
  },
  "bom": [
    { "category": "Fabric", "component": "string", "positioning": "string", "comment": "string", "supplier": "string" },
    { "category": "Wash", "component": "string", "positioning": "string", "comment": "string", "supplier": "string" },
    { "category": "Trims", "component": "string", "positioning": "string", "comment": "string", "supplier": "string" },
    { "category": "Labels", "component": "string", "positioning": "string", "comment": "string", "supplier": "string" }
  ],
  "measurements": [
    { "id": "string (e.g. BW003)", "point": "string", "description": "string", "value": "string", "tolMinus": "string", "tolPlus": "string" }
  ],
  "callouts": [
    { "id": "number", "description": "string (construction details like stitch density, embroidery, etc.)" }
  ]
}

Carefully identify the specific style, silhouette, and features of the garment in the image to populate the \`properties\` accurately.
For \`bom\`, accurately guess the materials, washes, trims, and labels required to construct this specific garment.
For \`measurements\`, use the THREE provided geometric anchors to mathematically triangulate and scale the exact proportions. Include at least 8-10 key measurements (including echoing the three anchors exactly as provided) using standard apparel IDs (like BW001, LEN246, SLV426, STY121). 
For \`callouts\`, include 5-8 explicit detailed instructions numbered 1-9 as per the template.`;

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
