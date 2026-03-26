import { GoogleGenerativeAI } from '@google/generative-ai';

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
    const { frontPart, backPart } = req.body;

    if (!frontPart) {
       return res.status(400).json({ error: 'Missing frontPart image data.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are an expert technical product designer.
Analyze this product mockup. 
Identify the specific type and style of this product (e.g., "Drop-Hem Short Sleeve T-Shirt", "Oversized Hoodie", "Hiking Backpack", "Canvas Tote Bag", "Cargo Pants").
Then, determine exactly 2 critical, easily measurable anchor dimensions that a user should physically measure on this specific product to establish its foundational scale and proportion (e.g., for a T-Shirt: "Chest Width (cm)" and "Front Body Length (cm)"; for a Backpack: "Total Height (cm)" and "Total Width at Base (cm)"; for Pants: "Waist Width (cm)" and "Inseam (cm)").

Respond ONLY with a valid JSON object in this exact format, with no markdown wrappers:
{
  "type": "string",
  "anchors": [
    { "id": "anchor1", "label": "string", "description": "string (brief instruction on where to measure)" },
    { "id": "anchor2", "label": "string", "description": "string" }
  ]
}`;

    const parts: any[] = [prompt, frontPart];
    if (backPart) {
       parts.push("\n\nThe following is the BACK side of the garment:");
       parts.push(backPart);
    }

    const result = await model.generateContent(parts);
    let text = result.response.text().trim();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(text);
    return res.status(200).json({ data });

  } catch (err: any) {
    console.error("Gemini API Error details:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
