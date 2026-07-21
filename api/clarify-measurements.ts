import { GoogleGenerativeAI } from "@google/generative-ai";

// Rebuild trigger to force Vercel build queue sync
export const maxDuration = 60;

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
    const { measurements, garmentType } = req.body;

    if (!measurements || !Array.isArray(measurements)) {
       return res.status(400).json({ error: 'Missing measurements list.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert apparel technical designer.
The user has a list of points of measure (POM) for a "${garmentType || 'Garment'}".
Your task is to rewrite the "description" field of each measurement to be extremely clear, layperson-friendly instructions on exactly how to take that measurement on the physical garment.

CRITICAL INSTRUCTIONS:
1. Explain step-by-step where to place the measuring tape (e.g., "Measure flat straight across the bottom opening from edge to edge").
2. DO NOT use technical industry jargon (like "sweep", "POM", etc.) that is confusing to non-designers.
3. Keep the "id", "point", "value", "tolMinus", "tolPlus", and any other fields EXACTLY the same. Only rewrite the "description" field!
4. Return ONLY a valid JSON array in this exact format (no markdown wrappers, no backticks):
[
  { "id": "string", "point": "string", "description": "rewritten clear instruction", "value": "string", "tolMinus": "string", "tolPlus": "string", "sizes": {} }
]

Input measurements list:
${JSON.stringify(measurements, null, 2)}`;

    const result = await model.generateContent([prompt]);
    let text = result.response.text().trim();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    if (text.indexOf('[') > 0) {
      text = text.substring(text.indexOf('['));
    }
    if (text.lastIndexOf(']') < text.length - 1) {
      text = text.substring(0, text.lastIndexOf(']') + 1);
    }

    const data = JSON.parse(text);
    return res.status(200).json({ data });

  } catch (err: any) {
    console.error("Clarify Measurements Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
