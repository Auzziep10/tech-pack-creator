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
    const { base64Data, mimeType, colorHex } = req.body;

    if (!base64Data || !mimeType || !colorHex) {
       return res.status(400).json({ error: 'Missing base64Data, mimeType, or colorHex payload.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
    const prompt = `TASK: Recoloring
CRITICAL CONSTRAINTS:
1. ONLY change the color of the garment in the image to exactly match this hex color code: ${colorHex}.
2. Preserve all lighting, shadows, fabric textures, folds, and details authentically ON THE GARMENT ONLY.
3. ISOLATE ON PURE WHITE (ULTRA-CRITICAL): The garment MUST be completely isolated on a flat, solid, mathematically pure white background (HEX #FFFFFF). Absolutely NO shadows on the floor. NO cream, off-white, light grey, or transparent backgrounds. NO gradients. Every non-garment pixel MUST be exactly #FFFFFF.
4. EXACT CROPPING & POSITION (CRITICAL): You MUST output an image with the EXACT same framing, dimensions, padding, zoom level, and centered placement as the FIRST image. The garment MUST perfectly overlap the first image pixel-for-pixel in scale and position.`;

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
    
    let text = result.response.text();
    text = text.replace(/```png\n?/gi, '').replace(/```base64\n?/gi, '').replace(/```\n?/g, '').replace(/\s+/g, '').trim();
    
    if (text.startsWith("data:image/")) {
      return res.status(200).json({ data: text });
    }

    return res.status(200).json({ data: `data:image/png;base64,${text}` });

  } catch (err: any) {
    console.error("Recoloring Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
