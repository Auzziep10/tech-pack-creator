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
    const { base64Data, mimeType, gender, garmentType, viewPoint, fitStyle } = req.body;

    if (!base64Data || !mimeType) {
       return res.status(400).json({ error: 'Missing base64Data or mimeType payload.' });
    }

    const FIT_DESCRIPTIONS: Record<string, string> = {
      Fitted: "FITTED SILHOUETTE: Form-fitting tailored style hugging body contours snugly with defined waist taper, tapered sleeves, and sleek athletic lines.",
      Standard: "STANDARD SILHOUETTE: Classic regular fit with a natural, comfortable 3D drape around the body without being tight or oversized.",
      Loose: "LOOSE SILHOUETTE: Relaxed, comfortable fit with soft fluid drape through chest and waist while maintaining natural body lines.",
      Boxy: "BOXY / OVERSIZED STREETWEAR SILHOUETTE (CRITICAL STRICT REQUIREMENT): Distinct wide 90s streetwear boxy cut. Render wide dropped shoulders, extra-wide chest breadth, and STRAIGHT VERTICAL SIDE SEAMS dropping straight down from armpits to hem without ANY waist taper, body curvature, or waist pinching. The bottom hem and ribbing MUST be wide, straight, and uncinched, matching the broad chest width across a rectangular 3D torso stance.",
      Athleisure: "ATHLEISURE SILHOUETTE: Streamlined athletic lifestyle fit engineered for lightweight performance drape, smooth ergonomic contouring, and activewear proportions."
    };

    const activeFitInstruction = fitStyle && FIT_DESCRIPTIONS[fitStyle] ? FIT_DESCRIPTIONS[fitStyle] : FIT_DESCRIPTIONS['Standard'];

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
    const prompt = `TASK: Professional 3D Invisible Ghost Mannequin Apparel Render (Ultra-High Precision 3D Volume)

CRITICAL COLOR & FABRIC FIDELITY INSTRUCTIONS (HIGHEST PRIORITY):
1. EXACT COLOR & FABRIC REPRODUCTION (ZERO COLOR SHIFT):
   - You MUST match the EXACT hue, saturation, color temperature, and brightness of the input garment.
   - HEATHER & MELANGE FABRICS (CRITICAL): If the source garment is heathered, slub-knit, marled, or multi-toned (e.g. slate heather, charcoal flecks, heather navy, triblend grey), you MUST explicitly reproduce that exact speckled heather texture and subtle color variations. DO NOT turn heathered, textured, or multi-tone fabrics into generic solid monochrome grey, black, or white.
   - UNDERSIDE & INSIDE COLLAR: Retain the natural interior fabric tone visible inside the 3D neck opening.

2. EXACT TRIMS, LABELS & CONSTRUCTION FIDELITY:
   - COLLAR & NECKBAND: Match the original collar rib width, neckline shape, topstitching style, and ribbing density.
   - NECK LABELS & BRANDING: Preserve all woven collar tags, printed size labels, neck tapes, and inner brand markings in their exact original color, size, text alignment, and position.
   - STITCHING & HEMS: Replicate the sleeve hem stitching, bottom hem coverstitching, and shoulder seam construction.

3. 3D GHOST MANNEQUIN EFFECT & FIT PROPORTIONS (CRITICAL):
   - Fill out the garment into a 3D anatomical volume as if worn by an invisible human body (3D Ghost Mannequin).
   - HOLLOW NECK OPENING: Show the 3D hollow interior dimension of the back neck collar visible inside the opening.
   - SPECIFIC FIT & SILHOUETTE DIRECTIVE: ${activeFitInstruction}
   - FOR BOXY FIT (STRICT): DO NOT taper, pinch, or curve the waist inward! The side seams MUST drop straight down vertically from the armpits to a wide, square bottom hem. The chest and shoulders MUST be visibly wide and boxy with a wide rectangular stance.
   - The garment is a ${gender || 'Unisex'}'s ${garmentType || 'Garment'}.
   - VIEWPOINT: ${viewPoint || 'Front View'}. Render the garment from this exact perspective.
   - SLEEVES & ARMS (STRICT REQUIREMENT): Sleeves MUST hang vertically DOWNWARD along the sides of the 3D body torso. DO NOT spread sleeves horizontally sideways or stretch them out like a flat lay or T-pose.

4. ISOLATION & NEUTRAL LIGHTING:
   - BACKGROUND: Isolated on a 100% mathematically solid pure white background (HEX #FFFFFF). Zero background cast or shadows on surrounding white pixels.
   - LIGHTING: Soft, color-neutral 3D studio lighting (5000K neutral daylight) that highlights 3D body depth without washing out fabric colors.`;

    // Attempt generation with automatic retries for transient 503 / timeout errors
    let result: any = null;
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
        break; // Success
      } catch (genErr: any) {
        const isTransient = genErr?.message?.includes('503') ||
                            genErr?.message?.includes('Service Unavailable') ||
                            genErr?.message?.includes('Deadline expired') ||
                            genErr?.message?.includes('504') ||
                            genErr?.message?.includes('429');
        if (isTransient && attempt < maxRetries) {
          console.warn(`[Mannequin API] Transient error (attempt ${attempt + 1}/${maxRetries + 1}):`, genErr.message);
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

    return res.status(500).json({ error: "AI model did not return image data. Please click Regenerate again." });

  } catch (err: any) {
    console.error("Invisible Mannequin Generation Error:", err);
    let errMsg = err.message || 'Internal Server Error';
    if (errMsg.includes('503') || errMsg.includes('Service Unavailable') || errMsg.includes('Deadline expired')) {
      errMsg = 'The Google AI image generation service is temporarily busy (503 Service Unavailable). Please click "Create 3D Floating Garment" again in a few moments to retry.';
    }
    return res.status(500).json({ error: errMsg });
  }
}
