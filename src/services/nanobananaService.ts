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

    const prompt = "Act as an expert technical CAD designer. Create a pristine, flat black-and-white vector technical line-art CAD blueprint SVG of the garment shown in the image, EXACTLY like a professional apparel tech pack. Include measurement guide lines, construction stitching, and typical tech pack aesthetic. Pure white background (or transparent), high contrast lines, no photorealistic shading, just structural geometry. Return ONLY the raw valid SVG code starting with <svg> and ending with </svg>, with no markdown formatting. IMPORTANT: Ensure the <svg> tag includes width=\"1000\" and height=\"1000\".";

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
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;

    // Convert the AI-generated SVG flawlessly to a raw PNG raster
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1000;
        canvas.height = 1000;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png", 1.0));
        } else {
          resolve(svgDataUrl);
        }
      };
      img.onerror = () => {
        console.warn("Failed to render SVG to canvas for PNG conversion, falling back to raw SVG.");
        resolve(svgDataUrl);
      };
      img.src = svgDataUrl;
    });
  } catch (err) {
    console.error("Vectorization Error:", err);
    throw err;
  }
}
