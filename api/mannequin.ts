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
    const { base64Data, mimeType, garmentType, gender, viewPoint } = req.body;

    if (!base64Data || !mimeType) {
       return res.status(400).json({ error: 'Missing base64Data or mimeType payload.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
    const prompt = `TASK: Ghost Mannequin / Invisible Person 3D Effect
CRITICAL CONSTRAINTS:
1. GHOST MANNEQUIN EFFECT (CRITICAL): Transform the garment into a 3D, filled-out shape as if worn by an invisible person. It MUST look like it has volume and depth (a "ghost mannequin" or "hollow" look), NOT flat-layed on a table. If it is currently flat, you MUST add 3D depth and shape to it!
2. REMOVE HUMAN MODELS: If there is a person (man or woman) in the image, completely remove their body, head, arms, and legs. KEEP THE GARMENT ONLY, floating with 3D volume.
3. The garment is a ${gender || 'Unisex'}'s ${garmentType || 'Garment'}.
4. VIEWPOINT: ${viewPoint || 'Front View'}. Ensure the garment is rotated and fully displayed from this exact perspective.
5. BACKGROUND & LIGHTING (CRITICAL): The garment MUST be completely isolated on a flat, solid, mathematically pure white background (HEX #FFFFFF). Absolutely NO shadows casting on a wall behind it or on the floor. NO grey, off-white, or textured backdrops. Every single non-garment pixel MUST be exactly #FFFFFF.
6. PRESERVE DETAILS: Keep the fabric textures, details, and colors authentic to the original garment. Use soft, clean studio lighting to emphasize the 3D volume and contours of the garment itself.
7. ARMS AT SIDES: If the garment has sleeves (e.g. hoodies, t-shirts), ensure the sleeves/arms are resting naturally straight down at the sides. Do NOT cross, bend, or lift the arms.`;

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
    console.error("Invisible Mannequin Generation Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
