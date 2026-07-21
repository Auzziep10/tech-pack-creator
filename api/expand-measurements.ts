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
    const { frontPart, backPart, existingMeasurements, baseSize, garmentType, unit } = req.body;

    if (!frontPart) {
       return res.status(400).json({ error: 'Missing frontPart image data.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert technical apparel designer.
Analyze this product image of a "${garmentType || 'Garment'}".
The user has already established the following measurements for size ${baseSize || 'M'} (expressed in ${unit === 'in' ? 'inches' : 'centimeters'}):

${(existingMeasurements || []).map((m: any) => `- **${m.point}** (${m.id}): ${m.value}`).join('\n')}

TASK:
Identify 6-10 ADDITIONAL standard apparel points of measure (POM) for this garment type that are NOT in the list above. 
For example, if this is a hoodie/sweatshirt and we already have chest, total length, shoulder width, sleeve length, bottom opening, and hood height, you should generate new measurements for:
- Hood Width
- Neck Opening/Width
- Front Neck Drop
- Back Neck Drop
- Armhole Height (Curve or Straight)
- Cuff Height
- Bottom Hem Height
- Pocket Width/Height/Opening
- Sleeve Cuff/Opening Width

CRITICAL CONSTRAINTS:
1. DO NOT duplicate any of the existing points of measure listed above.
2. Mathematically scale the values of the new measurements to perfectly match the proportions of the existing measurements.
3. VERY IMPORTANT: Output the new measurement values in the exact same unit as the existing ones (${unit === 'in' ? 'inches' : 'centimeters'}). If the unit is inches, format values as clean numbers or fractions (e.g. "19", "1 1/2", "9 3/4"). If centimeters, use decimal numbers.
4. Return ONLY a valid JSON object in this exact format (no markdown wrappers, no backticks):
{
  "newMeasurements": [
    { "id": "string (standard apparel ID e.g. CO002, AH001, CF001)", "point": "string (name of POM)", "description": "string (brief measurement instruction)", "value": "string (the scaled value)", "tolMinus": "string (e.g. 1/8 or 0.5)", "tolPlus": "string" }
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

    if (text.indexOf('{') > 0) {
      text = text.substring(text.indexOf('{'));
    }
    if (text.lastIndexOf('}') < text.length - 1) {
      text = text.substring(0, text.lastIndexOf('}') + 1);
    }

    const data = JSON.parse(text);
    return res.status(200).json({ data });

  } catch (err: any) {
    console.error("Expand Measurements Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
