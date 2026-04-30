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
    const { measurements, baseSize, targetSize, garmentType } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are an expert technical pattern maker and garment grader.
The user has a "${garmentType}" tech pack with base measurements in size ${baseSize}.
They need you to accurately grade these measurements for size ${targetSize}.

Base Measurements (Size ${baseSize}):
${JSON.stringify(measurements, null, 2)}

Please apply standard industry grading rules for this garment type to calculate the measurements for size ${targetSize}.
Return ONLY a JSON array of the updated measurement objects. Do NOT use markdown code blocks, just raw JSON.
Each object must have exactly these keys, matching the input:
{ "id": "string", "point": "string", "description": "string", "value": "string", "tolMinus": "string", "tolPlus": "string" }
The "value" field MUST be the newly calculated graded measurement. Keep the IDs and points exactly the same.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    if (jsonStr.indexOf('[') > 0) jsonStr = jsonStr.substring(jsonStr.indexOf('['));
    if (jsonStr.lastIndexOf(']') < jsonStr.length - 1) jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf(']') + 1);

    return res.status(200).json({ data: JSON.parse(jsonStr) });

  } catch (err: any) {
    console.error("Gemini API Error details:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
