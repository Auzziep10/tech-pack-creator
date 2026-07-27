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
    const { base64Data, mimeType, maskBase64, maskMimeType } = req.body;

    if (!base64Data || !maskBase64) {
       return res.status(400).json({ error: 'Missing base64Data or maskBase64 payload.' });
    }

    let cleanBase64Data = base64Data;
    let actualMimeType = mimeType || "image/jpeg";
    if (base64Data.includes(";base64,")) {
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        actualMimeType = match[1];
        cleanBase64Data = match[2];
      }
    }

    let maskData = maskBase64;
    let actualMaskMimeType = maskMimeType || "image/png";
    if (maskBase64.includes(";base64,")) {
      const match = maskBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        actualMaskMimeType = match[1];
        maskData = match[2];
      }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
    const prompt = `TASK: Erase Branding / Logos / Labels
CRITICAL CONSTRAINTS:
1. REMOVE all existing branding, labels, logos, tags, graphics, or text inside the black region of the mask provided in the second image.
2. FILL the erased area seamlessly, matching the surrounding garment fabric color, texture, folds, and lighting so it looks completely clean, blank, and untouched.
3. DO NOT change anything else on the garment. The rest of the garment, background, and lighting MUST remain identical to the first image.
4. ISOLATE ON PURE WHITE (ULTRA-CRITICAL): The garment MUST be completely isolated on a flat, solid, mathematically pure white background (HEX #FFFFFF). Absolutely NO shadows on the floor. NO cream, off-white, light grey, or transparent backgrounds. NO gradients. Every non-garment pixel MUST be exactly #FFFFFF.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: cleanBase64Data,
          mimeType: actualMimeType
        }
      },
      {
        inlineData: {
          data: maskData,
          mimeType: actualMaskMimeType
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
    console.error("Erase Branding Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
