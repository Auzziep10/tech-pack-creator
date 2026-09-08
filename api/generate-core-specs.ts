import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY configuration.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const { frontPart, garmentType, unit, baseSize } = req.body;

    if (!frontPart) {
       return res.status(400).json({ error: 'Missing frontPart image.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert technical apparel designer.
Analyze this product image of a "${garmentType || 'Garment'}".
Your task is to estimate and generate the four core points of measure (POM) required for 3D fit matching in size ${baseSize || 'M'} (expressed in ${unit === 'in' ? 'inches' : 'centimeters'}):
1. Chest Width / Bust Width (measured flat across the chest, 1 inch below armhole)
2. Waist Width (measured flat across the narrowest part of the waist)
3. Hem Width (measured flat across the bottom opening of the garment)
4. Sleeve Length (measured from Center Back Neck or shoulder seam to cuff hem - choose appropriate based on garment style)

CONSTRAINTS:
1. Estimate highly realistic, industry-standard values for these four POMs for this type of garment.
2. VERY IMPORTANT: Output values in the exact same unit requested (${unit === 'in' ? 'inches' : 'centimeters'}). If the unit is inches, format values as clean numbers or fractions (e.g. "23 1/2", "22", "31"). If centimeters, use decimal numbers.
3. Return ONLY a valid JSON object in this exact format (no markdown wrappers, no backticks):
{
  "coreMeasurements": [
    { "id": "CH001", "point": "Chest Width", "description": "Measure flat across the chest, 1 inch below the armhole seam from edge to edge.", "value": "string (estimated value)" },
    { "id": "WS001", "point": "Waist Width", "description": "Measure flat across the narrowest part of the waist from edge to edge.", "value": "string (estimated value)" },
    { "id": "HM001", "point": "Hem Width", "description": "Measure flat straight across the bottom opening of the garment from edge to edge.", "value": "string (estimated value)" },
    { "id": "SL001", "point": "Sleeve Length", "description": "Measure from the collar seam/shoulder/CB neck down to the end of the sleeve cuff.", "value": "string (estimated value)" }
  ]
}`;

    const parts = [prompt, frontPart];
    const result = await model.generateContent(parts);
    let text = result.response.text().trim();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    if (text.indexOf('{') > 0) {
      text = text.substring(text.indexOf('{'));
    }
    if (text.lastIndexOf('}') < text.length - 1) {
      text = text.substring(0, text.lastIndexOf('}') + 1);
    }

    const data = JSON.parse(text);
    return res.status(200).json({ data });

  } catch (err: any) {
    console.error("Generate Core Specs Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
