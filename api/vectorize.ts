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

    const model = genAI.getGenerativeModel({ model: "nano-banana-pro-preview" });
    const prompt = "Act as an expert technical CAD designer. Perform a meticulous image trace on the outline of the garment and its prominent internal structural features. Create a pristine, flat black-and-white technical line-art CAD blueprint representation of the garment shown in the image, EXACTLY like a professional apparel tech pack. Include construction stitching and typical tech pack aesthetic, but DO NOT include measurement guide lines, arrows, or text callouts (those will be drawn manually). Pure white background (or transparent), high contrast lines, no photorealistic shading, just structural geometry. CRITICAL PERFORMANCE INSTRUCTION: Keep the image output highly optimized. Return ONLY a valid base64 encoded raw PNG image representing the artwork, with absolutely no markdown formatting, no JSON, and no other text.";

    let result: any;
    try {
      // 15 sec timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("TIMEOUT")), 15000)
      );

      result = await Promise.race([
        model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType
            }
          }
        ]),
        timeoutPromise
      ]);
    } catch (apiErr: any) {
      if (apiErr.message?.includes("TIMEOUT") || apiErr.message?.includes("503") || apiErr.status === 503 || apiErr.message?.includes("high demand")) {
        console.warn("Nano Banana took too long or is at capacity. Falling back to blazing fast gemini-2.5-flash...");
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        result = await fallbackModel.generateContent([
          prompt,
          {
            inlineData: {
               data: base64Data,
               mimeType
            }
          }
        ]);
      } else {
        throw apiErr;
      }
    }

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
