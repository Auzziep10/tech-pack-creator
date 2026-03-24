import { GoogleGenerativeAI } from "@google/generative-ai";

export async function vectorizeGarmentImage(imageUrl: string, apiKey: string): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-pro for best vision/SVG capabilities
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

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

    const prompt = "Act as an expert technical CAD designer. Create a pristine, flat black-and-white vector technical line-art CAD blueprint SVG of the garment shown in the image. Pure white background (or transparent), high contrast lines, no photorealistic shading, just structural geometry. Return ONLY the raw valid SVG code starting with <svg> and ending with </svg>, with no markdown formatting and no other text.";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType
        }
      }
    ]);
    
    let text = result.response.text();
    text = text.replace(/```xml\n?/g, '').replace(/```svg\n?/g, '').replace(/```\n?/g, '').trim();
    
    const startIdx = text.indexOf("<svg");
    if (startIdx !== -1) {
      text = text.substring(startIdx);
    }
    const endIdx = text.lastIndexOf("</svg>");
    if (endIdx !== -1) {
      text = text.substring(0, endIdx + 6);
    } else {
      console.warn("Could not find ending </svg> tag in response.", text);
    }

    const encodedSvg = encodeURIComponent(text);
    return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
  } catch (err) {
    console.error("Vectorization Error:", err);
    throw err;
  }
}
