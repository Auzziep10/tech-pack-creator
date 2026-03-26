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
    const prompt = `Act as an expert technical CAD designer. Perform a meticulous image trace on the outline of the garment and its prominent internal structural features. Create a pristine, flat black-and-white technical line-art CAD blueprint representation of the garment shown in the image, EXACTLY like a professional apparel tech pack.

CRITICAL INSTRUCTIONS:
1. You MUST output your design STRICTLY as a valid, raw HTML <svg> element.
2. The <svg> MUST contain highly detailed <path> elements with stroke="black" and fill="none" representing every contour, seam, pocket, and boundary of the exact garment in the photo.
3. Use a viewBox representing a clean square (e.g., viewBox="0 0 1000 1000") and scale your paths accordingly.
4. ONLY draw actual physical seams, stitches, and structural boundaries. No wrinkles, shading, or background.
5. DO NOT wrap your response in markdown blocks like \`\`\`svg. Output ONLY the raw <svg> string from start to finish.`;

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
    text = text.replace(/```svg\n?/gi, '').replace(/```\n?/g, '').trim();

    // Standardize to a safe base64 encoded SVG data URL
    const svgBase64 = Buffer.from(text).toString('base64');
    return res.status(200).json({ data: `data:image/svg+xml;base64,${svgBase64}` });

  } catch (err: any) {
    console.error("Vectorization Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
