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
    const { frontPart, backPart, anchors, anchorValues, baseSize, garmentType, wovnMetadata } = req.body;

    if (!frontPart) {
       return res.status(400).json({ error: 'Missing frontPart image data.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are an expert technical product designer.
Analyze this product mockup. It was previously classified as a "${garmentType}".
To permanently eliminate camera lens distortion (where the top of the product is closer to the lens than the bottom in flat-lays), the user has provided the following precise geometric anchors for a size ${baseSize}:

${anchors.map((a: any) => `- **${a.label}**: ${anchorValues[a.id]}`).join('\n')}

${wovnMetadata ? `CRITICAL INSTRUCTION: This garment is being imported from the company's Catalog. You MUST integrate the following specifications into the Tech Pack (especially the properties and BOM):
- **Product Name**: ${wovnMetadata.garment_name || 'N/A'}
- **Fabric/Material**: ${wovnMetadata.fabric_details || 'N/A'}
- **Fabric Weight**: ${wovnMetadata.fabric_weight_gsm || 'N/A'}
- **Care Instructions**: ${wovnMetadata.care_instructions || 'N/A'}
- **Decoration**: ${wovnMetadata.decoration_method || 'N/A'}
- **Fit**: ${wovnMetadata.fit || 'N/A'}
` : ''}
Based on this image and these exact architectural anchors, generate a complete Tech Pack in strict JSON format. Do not use markdown blocks, just raw JSON.
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
    "designer": "string",
    "baseSize": "string"
  },
  "bom": [
    { "category": "Fabric", "component": "string", "positioning": "string", "comment": "string", "supplier": "string" },
    { "category": "Fabric Finish", "component": "string", "positioning": "string", "comment": "string", "supplier": "string" },
    { "category": "Fabric Dye", "component": "string", "positioning": "string", "comment": "string", "supplier": "string" },
    { "category": "Trims", "component": "string", "positioning": "string", "comment": "string", "supplier": "string" },
    { "category": "Labels", "component": "string", "positioning": "string", "comment": "string", "supplier": "string" }
  ],
  "measurements": [
    { "id": "string (e.g. BW003)", "point": "string", "description": "string (very clear, layperson-friendly instruction on exactly how and where to measure, e.g. 'Measure flat straight across the chest, 1 inch below the armhole seam from edge to edge.')", "value": "string", "tolMinus": "string", "tolPlus": "string" }
  ],
  "callouts": "string (A concise, high-level overview of quick notes summarizing what is seen about the garment. E.g. key visual characteristics, silhouette & fit, collar/neckline style, fabric finish/drape, and notable styling highlights. Format as clean bullet points separated by \\n. Keep it quick, clear, and overview-level rather than step-by-step factory sewing instructions. Must be a single string.)"
}

Carefully identify the specific style, silhouette, and features of the product in the image to populate the \`properties\` accurately.
For \`bom\`, accurately guess the materials, washes, hardware, trims, and labels required to construct this specific product.
For \`measurements\`, use the provided geometric anchors to mathematically triangulate and scale the exact proportions. VERY IMPORTANT: ALL measurements outputted MUST be strictly in Centimeters (cm). If the provided anchors are explicitly non-metric (e.g in inches), you MUST mathematically convert them to cm first before rendering the JSON.

MANDATORY STANDARD POINTS OF MEASURE (POM):
The tech pack MUST ALWAYS start with the following 17 standard measurements in this exact order:
1. "Front Body Length (HPS)" (id: "FL001")
2. "Back Body Length (HPS)" (id: "BL001")
3. "Chest Width" (id: "CW001")
4. "Waist" (id: "WS001")
5. "Bottom / Hem Opening" (id: "HM001")
6. "Bottom Hem / Cuff Height" (id: "HH001")
7. "Shoulder Seam Length" (id: "SS001")
8. "Shoulder Width" (id: "SW001")
9. "Armhole Height (Straight)" (id: "AH001")
10. "Sleeve Length" (id: "SL001")
11. "Bicep Width" (id: "BW001")
12. "Sleeve / Cuff Opening" (id: "CO001")
13. "Cuff Height" (id: "CH001")
14. "Neck Width / Opening" (id: "NW001")
15. "Collar Width" (id: "CW002")
16. "Front Neck Drop" (id: "FD001")
17. "Back Neck Drop" (id: "BD001")

ADDITIONAL GARMENT-SPECIFIC MEASUREMENTS:
After these 17 standard measurements above, identify and append any garment-specific measurements recognized on the product. For example:
- If the garment has a hood (hoodie, hooded jacket): append "Hood Height" (HD001), "Hood Width" (HD002), and hood drawstring/opening measurements.
- If the garment has a kangaroo or front pocket: append "Pocket Height" (PK001), "Pocket Width" (PK002), and "Pocket Opening" (PK003).
- If the garment has a zipper, placket, or button closure: append "Placket Length" / "Zipper Length".
- If the garment has slits or vents: append "Side Slit Height".

For the \`description\` field of every measurement, write a very clear, step-by-step instruction on exactly how to take that measurement on the physical garment. DO NOT use technical industry jargon (like "sweep", "POM", etc.) that is confusing to non-designers.
For \`callouts\`, provide a concise set of quick notes summarizing the visual design and garment overview as observed from the image (e.g. silhouette, overall fit, collar/neckline construction, sleeve style, fabric appearance, and key styling accents). Do NOT write an overly detailed factory sewing or assembly manual; keep it to straightforward, high-level overview bullet points.`;

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
