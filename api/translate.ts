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
    const { techPackData, targetLanguage } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are an expert technical apparel translator.
Translate the text values in the following JSON tech pack into ${targetLanguage}.

CRITICAL INSTRUCTIONS:
1. ONLY translate text descriptions, comments, points of measure, materials, and categories.
2. DO NOT translate keys, property names, IDs (e.g. "BW003"), numeric values, size labels (e.g. "M", "L"), or URLs.
3. Maintain the exact same JSON structure.
4. Return ONLY valid, raw JSON. Do not include markdown formatting like \`\`\`json.

JSON Data:
${JSON.stringify(techPackData, null, 2)}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
    let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    if (jsonStr.indexOf('{') > 0) jsonStr = jsonStr.substring(jsonStr.indexOf('{'));
    if (jsonStr.lastIndexOf('}') < jsonStr.length - 1) jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf('}') + 1);

    return res.status(200).json({ data: JSON.parse(jsonStr) });

  } catch (err: any) {
    console.error("Translation API Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
