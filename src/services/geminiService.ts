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

export async function analyzeGarmentForMeasurement(imageDataUrl: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imagePart = base64ToGenerativePart(imageDataUrl);
    
    const prompt = `You are an expert technical apparel designer.
Analyze this garment mockup. To create a full technical specification pack (Tech Pack) for manufacturing, you need one key "anchor" measurement to scale the rest.
What is the single most important measurement you need from the user to determine the rest? (e.g., "Chest Width", "Body Length", "Inseam").
Respond ONLY with the name of the measurement, nothing else.`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text().trim();
    return response || "Chest Width";
  } catch (error) {
    console.warn("Gemini API Error (likely using stub key). Falling back to default.");
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1500));
    return "Chest Width";
  }
}

export async function generateTechPack(imageDataUrl: string, keyMeasurementName: string, keyMeasurementValue: string, baseSize: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imagePart = base64ToGenerativePart(imageDataUrl);
    
    const prompt = `You are an expert technical apparel designer.
Analyze this garment mockup. The user has provided the following anchor measurement for a size ${baseSize}:
${keyMeasurementName}: ${keyMeasurementValue}

Based on this image and the anchor measurement, generate a complete Tech Pack in strict JSON format. Do not use markdown blocks, just raw JSON.
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

Ensure the measurements are mathematically realistic proportional to the anchor measurement provided. Include at least 6 key measurements, 4 callouts, and 1-2 fabrication details.`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();
    
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.warn("Gemini API Error (likely using stub key). Returning mock data.");
    await new Promise(r => setTimeout(r, 2000));
    return {
      measurements: [
        { point: keyMeasurementName, description: "Anchor measurement provided by user", value: keyMeasurementValue, tolerance: "+/- 0.5\"" },
        { point: "Body Length", description: "HPS to bottom hem", value: "28\"", tolerance: "+/- 0.5\"" },
        { point: "Sleeve Length", description: "Center back to sleeve opening", value: "35\"", tolerance: "+/- 0.5\"" },
        { point: "Shoulder Width", description: "Seam to seam across back", value: "19\"", tolerance: "+/- 0.25\"" },
        { point: "Bottom Hem Opening", description: "Straight across bottom edge", value: "21.5\"", tolerance: "+/- 0.5\"" },
        { point: "Neck Opening", description: "Seam to seam at collarbone", value: "8\"", tolerance: "+/- 0.25\"" }
      ],
      callouts: [
        { id: 1, description: "Double needle coverstitch at hems and sleeve openings" },
        { id: 2, description: "Woven brand label placed precisely 2\" below back neckline on the inside" },
        { id: 3, description: "1/4\" twill tape neck seam cover for durability" },
        { id: 4, description: "Bar tacks at corner stress points of the kangaroo pocket" }
      ],
      fabrication: [
        { placement: "Main Body", material: "100% Combed Cotton French Terry", weight: "400gsm", notes: "Pre-shrunk, enzyme washed" },
        { placement: "Ribbing at Cuffs/Hem", material: "98% Cotton / 2% Elastane 2x1 Rib", weight: "380gsm", notes: "Color-matched to main body" }
      ]
    };
  }
}
