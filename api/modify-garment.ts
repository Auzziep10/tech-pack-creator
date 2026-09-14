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
    const { 
      action, 
      base64Data, 
      mimeType = "image/jpeg", 
      maskBase64, 
      maskMimeType = "image/png", 
      prompt: userPrompt,
      styleOption = "Screenprint"
    } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data image payload.' });
    }

    let cleanBase64Data = base64Data;
    let actualMimeType = mimeType;
    if (base64Data.includes(";base64,")) {
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        actualMimeType = match[1];
        cleanBase64Data = match[2];
      }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
    const contentParts: any[] = [];

    if (action === 'inpaint') {
      if (!maskBase64) {
        return res.status(400).json({ error: 'Missing maskBase64 payload for area modification.' });
      }

      let cleanMaskData = maskBase64;
      let actualMaskMimeType = maskMimeType;
      if (maskBase64.includes(";base64,")) {
        const match = maskBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          actualMaskMimeType = match[1];
          cleanMaskData = match[2];
        }
      }

      const inpaintPrompt = `TASK: Precision Garment Area Modification / Inpainting
USER MODIFICATION SPECIFICATION: "${userPrompt || 'Modify the selected garment area'}"

CRITICAL INSTRUCTIONS & CONSTRAINTS:
1. FOCUS STRICTLY ON MASKED AREA: The second image provided is a precision mask where the black drawn region (on pure white background) highlights the exact target area. Apply the requested modification ONLY inside that masked region.
2. SEAMLESS APPAREL INTEGRATION:
   - Match the exact garment silhouette, panel seams, fabric knit/weave, yarn weight, drape, and lighting style of the original garment.
   - Blend the edges of the modified region smoothly into the surrounding fabric without harsh borders, artifacts, or blurriness.
3. PRESERVE UNMASKED AREAS IDENTICAL:
   - Every single part of the garment outside the masked region MUST remain completely unchanged, preserving color, shape, stitching, and hardware.
4. ISOLATE ON PURE WHITE BACKGROUND (ULTRA-CRITICAL):
   - The garment MUST be completely isolated on a flat, solid, mathematically pure white background (HEX #FFFFFF).
   - Absolutely NO floor shadows, no gradients, no grey casts, and no studio scenery. Every background pixel outside the garment MUST be exactly #FFFFFF.`;

      contentParts.push(inpaintPrompt);
      contentParts.push({
        inlineData: {
          data: cleanBase64Data,
          mimeType: actualMimeType
        }
      });
      contentParts.push({
        inlineData: {
          data: cleanMaskData,
          mimeType: actualMaskMimeType
        }
      });

    } else if (action === 'bake-logo') {
      const STYLE_DIRECTIVES: Record<string, string> = {
        'Screenprint': 'REALISTIC SCREENPRINT: The graphic has a smooth, slightly matte ink deposit with subtle ink penetration into the cloth fibers and microscopic surface grain.',
        'Embroidered': 'REALISTIC EMBROIDERY: Render the logo with distinct 3D embroidered thread satin/fill stitches, subtle thread sheen, raised textural thread borders, and stitch directionality conforming to the garment surface.',
        'Vintage Distressed': 'VINTAGE / DISTRESSED PRINT: The graphic shows subtle micro-cracking, gentle faded patina, weathered wear, and soft fiber show-through consistent with a premium vintage washed garment.',
        'Direct-to-Garment': 'DIRECT-TO-GARMENT (DTG) / SOFT-HAND: The water-based ink is absorbed directly into the cotton knit fibers with ultra-soft hand feel, allowing the natural garment rib/weave texture to show through cleanly.'
      };

      const styleInstruction = STYLE_DIRECTIVES[styleOption] || STYLE_DIRECTIVES['Screenprint'];

      const bakePrompt = `TASK: Realistic Apparel Logo & Graphic Baking (Ultra-Realistic Fabric Integration)
PRINT / EMBROIDERY FINISH: ${styleInstruction}

CRITICAL FABRIC INTEGRATION DIRECTIVES (HIGHEST PRIORITY):
1. BAKE THE LOGO REALISTICALLY INTO THE GARMENT:
   - The graphic/logo overlaid on the garment in the input image MUST be rendered as a physical, realistic part of the actual textile.
   - DRAPE & FOLD CONFORMITY: Deform and conform the logo naturally along all cloth wrinkles, fabric ripples, surface curvature, and folds underneath it. It must NOT look like a flat 2D sticker or digital graphic.
   - LIGHTING & SHADOWING: Cast realistic highlights, ambient shadows, and crease shadows across the logo matching the exact 3D lighting of the garment.
   - TEXTILE TEXTURE INTERACTION: Embed the subtle texture of the garment fabric (knit, fleece, twill, or rib) through the graphic finish.
2. PRESERVE THE LOGO SHAPE & DETAILS:
   - Maintain the logo's intended graphic proportions, lettering, typography, colors, and placement while integrating it physically into the fabric.
3. PRESERVE THE REST OF THE GARMENT:
   - Keep the garment color, silhouette, collar, sleeves, hems, and details identical to the input image.
4. ISOLATE ON PURE WHITE BACKGROUND (ULTRA-CRITICAL):
   - The garment MUST be completely isolated on a flat, solid, mathematically pure white background (HEX #FFFFFF).
   - Absolutely NO floor shadows, no grey halos, and no background objects. Every background pixel outside the garment MUST be exactly #FFFFFF.`;

      contentParts.push(bakePrompt);
      contentParts.push({
        inlineData: {
          data: cleanBase64Data,
          mimeType: actualMimeType
        }
      });

    } else {
      return res.status(400).json({ error: 'Invalid action parameter. Must be "inpaint" or "bake-logo".' });
    }

    // Execute generation with automated retries for transient Google AI service errors
    let result: any = null;
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        result = await model.generateContent(contentParts);
        break;
      } catch (genErr: any) {
        const isTransient = genErr?.message?.includes('503') ||
                            genErr?.message?.includes('Service Unavailable') ||
                            genErr?.message?.includes('Deadline expired') ||
                            genErr?.message?.includes('504') ||
                            genErr?.message?.includes('429');
        if (isTransient && attempt < maxRetries) {
          console.warn(`[Modify Garment API] Transient error (attempt ${attempt + 1}/${maxRetries + 1}):`, genErr.message);
          await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
          continue;
        }
        throw genErr;
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

    return res.status(500).json({ error: "AI model did not return image data. Please try again." });

  } catch (err: any) {
    console.error("Modify Garment API Error:", err);
    let errMsg = err.message || 'Internal Server Error';
    if (errMsg.includes('503') || errMsg.includes('Service Unavailable') || errMsg.includes('Deadline expired')) {
      errMsg = 'The Google AI image generation service is temporarily busy (503 Service Unavailable). Please try again in a few moments.';
    }
    return res.status(500).json({ error: errMsg });
  }
}
