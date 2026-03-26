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
    const { frontPart, backPart, chestWidth, bodyLength, shoulderWidth, baseSize, garmentType } = req.body;

    if (!frontPart) {
       return res.status(400).json({ error: 'Missing frontPart image data.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
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
  "callouts": "string (A detailed, systematic outline formatting the garment's construction from beginning to end. e.g., '1. Cutting & Prep\\n - Detail...\\n2. Body Assembly\\n - Detail...'. Ensure \\n are used for breaks. Must be a single large string.)"
}

Carefully identify the specific style, silhouette, and features of the garment in the image to populate the \`properties\` accurately.
For \`bom\`, accurately guess the materials, washes, trims, and labels required to construct this specific garment.
For \`measurements\`, use the THREE provided geometric anchors to mathematically triangulate and scale the exact proportions. VERY IMPORTANT: ALL measurements outputted MUST be strictly in Centimeters (cm). If the provided anchors are explicitly non-metric (e.g in inches), you MUST mathematically convert them to cm first before rendering the JSON. Include at least 8-10 key measurements (cm only) using standard apparel IDs (like BW001, LEN246, SLV426, STY121). 
For \`callouts\`, write a comprehensive, systematic outline detailing how the garment is constructed from beginning to end (e.g., proper sequence from Cutting => Assembly => Finishing). Use rigorous bullet points and line breaks.`;

    const parts: any[] = [prompt, frontPart];
    if (backPart) {
       parts.push("\n\nThe following is the BACK side of the garment:");
       parts.push(backPart);
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    
    let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Safety check just in case Gemini gives completely raw non-JSON blocks with the JSON
    if (jsonStr.indexOf('{') > 0) {
      jsonStr = jsonStr.substring(jsonStr.indexOf('{'));
    }
    if (jsonStr.lastIndexOf('}') < jsonStr.length - 1) {
      jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf('}') + 1);
    }

    return res.status(200).json({ data: JSON.parse(jsonStr) });

  } catch (err: any) {
    console.error("Gemini API Error details:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
