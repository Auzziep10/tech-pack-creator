import { GoogleGenerativeAI } from "@google/generative-ai";

export async function vectorizeGarmentImage(imageUrl: string, apiKey: string): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use nano-banana-pro-preview for best vision/SVG capabilities
    const model = genAI.getGenerativeModel({ model: "nano-banana-pro-preview" });

    let base64Data = imageUrl;
    let mimeType = "image/jpeg";

    if (imageUrl.startsWith("data:")) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    } else {
      // Handle if it's an http url or object url
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      mimeType = blob.type;
      const arrayBuffer = await blob.arrayBuffer();
      
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Data = window.btoa(binary);
    }

    const prompt = "Act as an expert technical CAD designer. Perform a meticulous image trace on the outline of the garment and its prominent internal structural features. Create a pristine, flat black-and-white technical line-art CAD blueprint representation of the garment shown in the image, EXACTLY like a professional apparel tech pack. Include construction stitching and typical tech pack aesthetic, but DO NOT include measurement guide lines, arrows, or text callouts (those will be drawn manually). Pure white background (or transparent), high contrast lines, no photorealistic shading, just structural geometry. CRITICAL PERFORMANCE INSTRUCTION: Keep the image output highly optimized. Return ONLY a valid base64 encoded raw PNG image representing the artwork, with absolutely no markdown formatting, no JSON, and no other text.";

    let result;
    try {
      result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType
          }
        }
      ]);
    } catch (apiErr: any) {
      if (apiErr.message?.includes("503") || apiErr.status === 503 || apiErr.message?.includes("high demand")) {
        console.warn("Nano Banana is at capacity. Falling back to gemini-3.1-pro-preview...");
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
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
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    let text = result.response.text();
    text = text.replace(/```png\n?/gi, '').replace(/```base64\n?/gi, '').replace(/```\n?/g, '').trim();
    
    if (text.startsWith("data:image/")) {
      return text;
    }

    return `data:image/png;base64,${text}`;
  } catch (err) {
    console.error("Vectorization Error:", err);
    throw err;
  }
}
