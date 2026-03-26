import { GoogleGenerativeAI } from '@google/generative-ai';

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
    
    const prompt = `You are an expert technical apparel designer.
Analyze this garment mockup. 
What is the specific type and style of this garment? (e.g., "Drop-Hem Short Sleeve T-Shirt", "Oversized Hoodie", "Crewneck Sweater").
Respond ONLY with the crisp name of the garment style, nothing else.`;

    const parts: any[] = [prompt, frontPart];
    if (backPart) {
       parts.push("\n\nThe following is the BACK side of the garment:");
       parts.push(backPart);
    }

    const result = await model.generateContent(parts);
    const response = result.response.text().trim();
    return res.status(200).json({ data: response || "Chest Width" });

  } catch (err: any) {
    console.error("Gemini API Error details:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
