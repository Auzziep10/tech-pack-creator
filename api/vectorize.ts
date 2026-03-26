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
    const { base64Data, mimeType } = req.body;

    if (!base64Data || !mimeType) {
       return res.status(400).json({ error: 'Missing base64Data or mimeType payload.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });
    const prompt = "Act as an expert technical CAD designer. Perform a meticulous image trace on the outline of the garment and its prominent internal structural features. Create a pristine, flat black-and-white technical line-art CAD blueprint representation of the garment shown in the image, EXACTLY like a professional apparel tech pack. Include construction stitching and typical tech pack aesthetic, but DO NOT include measurement guide lines, arrows, or text callouts (those will be drawn manually).\n\nCRITICAL SPECIFICATIONS:\n1. The garment MUST look PERFECTLY IRONED AND FLAT. Do NOT draw any internal lines that represent wrinkles, fabric folds, or draping. ONLY draw actual physical seams, stitches, and structural boundaries. If an internal line does not represent a physical stitched seam or hardware, DO NOT DRAW IT.\n2. If the garment has a hood, the hood MUST be drawn UP and prominently visible, mimicking its exact structure from the photo.\n\nKeep the output purely structural. Pure white background (or transparent), high contrast lines, no photorealistic shading. Return ONLY a valid base64 encoded raw PNG image representing the artwork, with absolutely no markdown formatting, no JSON, and no other text.";

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
    console.error("Vectorization Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
