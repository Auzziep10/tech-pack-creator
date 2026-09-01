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
    const apiKey = process.env.NANOBANANA_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY configuration.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const { base64Data, mimeType, gender, garmentType, viewPoint } = req.body;

    if (!base64Data || !mimeType) {
       return res.status(400).json({ error: 'Missing base64Data or mimeType payload.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
    const prompt = `TASK: Professional Studio Apparel Flat-Lay / Tabletop Flat Spread Render (Ultra-High Precision)

CRITICAL COLOR & FABRIC FIDELITY INSTRUCTIONS (HIGHEST PRIORITY):
1. EXACT COLOR & FABRIC REPRODUCTION (ZERO COLOR SHIFT):
   - You MUST match the EXACT hue, saturation, color temperature, and brightness of the input garment.
   - HEATHER & MELANGE FABRICS (CRITICAL): If the source garment is heathered, slub-knit, marled, or multi-toned (e.g. slate heather, charcoal flecks, heather navy, triblend grey), you MUST explicitly reproduce that exact speckled heather texture and subtle color variations. DO NOT turn heathered, textured, or multi-tone fabrics into generic solid monochrome grey, black, or white.
   - UNDERSIDE & INSIDE COLLAR: Retain the natural interior fabric tone visible inside the neck opening.

2. EXACT TRIMS, LABELS & CONSTRUCTION FIDELITY:
   - COLLAR & NECKBAND: Match the original collar rib width, neckline shape, topstitching style, and ribbing density.
   - NECK LABELS & BRANDING: Preserve all woven collar tags, printed size labels, neck tapes, and inner brand markings in their exact original color, size, text alignment, and position.
   - STITCHING & HEMS: Replicate the sleeve hem stitching, bottom hem coverstitching, and shoulder seam construction.

3. 2D FLAT-LAY TABLETOP PRESENTATION:
   - Render the garment laid completely flat on a smooth horizontal tabletop surface, cleanly spread out without any 3D body volume, human model, or ghost mannequin curvature.
   - The garment is a ${gender || 'Unisex'}'s ${garmentType || 'Garment'}.
   - VIEWPOINT: ${viewPoint || 'Front View'}. Render the flat garment from this direct top-down overhead perspective.
   - SLEEVES & HEMS: Sleeves are neatly extended symmetrically sideways at natural flat angles. The bottom hem is pressed straight and smooth.

4. ISOLATION & NEUTRAL LIGHTING:
   - BACKGROUND: Isolated on a 100% mathematically solid pure white background (HEX #FFFFFF). Zero background cast or shadows on surrounding white pixels.
   - LIGHTING: Soft, balanced studio tabletop overhead lighting (5000K neutral daylight) that shows clean fabric detail without harsh shadows.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType
        }
      }
    ]);

    const candidates = result.response?.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData) {
          return res.status(200).json({ data: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` });
        }
      }
    }
    
    let text = '';
    try {
      text = result.response.text() || '';
      text = text.replace(/```png\n?/gi, '').replace(/```base64\n?/gi, '').replace(/```\n?/g, '').replace(/\s+/g, '').trim();
    } catch (e) {
      text = '';
    }
    
    if (text.startsWith("data:image/")) {
      return res.status(200).json({ data: text });
    }

    if (text.length > 1000 && !text.includes(" ") && !text.includes("<") && !text.includes("\n")) {
      return res.status(200).json({ data: `data:image/png;base64,${text}` });
    }

    return res.status(500).json({ error: "AI model did not return image data. Please click Regenerate again." });

  } catch (err: any) {
    console.error("Flat-Lay Generation Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
