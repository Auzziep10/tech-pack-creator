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
    const { base64Data, mimeType, garmentType, gender, viewPoint, fitStyle } = req.body;

    if (!base64Data || !mimeType) {
       return res.status(400).json({ error: 'Missing base64Data or mimeType payload.' });
    }

    const FIT_DESCRIPTIONS: Record<string, string> = {
      Fitted: "FITTED SILHOUETTE: Form-fitting style hugging the mannequin body contours snugly with minimal excess fabric, defined waist/torso structure, and clean form-fitting lines.",
      Standard: "STANDARD SILHOUETTE: Classic regular fit with a natural, comfortable drape around the mannequin body without being tight or oversized.",
      Loose: "LOOSE SILHOUETTE: Relaxed, comfortable fit with soft fluid drape that naturally follows body contours. Slightly easy through chest and torso while maintaining a gentle tailored shape—NOT stiff, square, wide, or boxy.",
      Boxy: "BOXY SILHOUETTE: Distinctly wide, square silhouette with structured straight-down drop from the shoulders to a broad flat hem, featuring an oversized square boxy cut."
    };

    const activeFitInstruction = fitStyle && FIT_DESCRIPTIONS[fitStyle] ? FIT_DESCRIPTIONS[fitStyle] : FIT_DESCRIPTIONS['Standard'];

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
    const prompt = `TASK: Professional Invisible Mannequin / 3D Floating Garment Render (Ultra-High Precision)

CRITICAL COLOR & FABRIC FIDELITY INSTRUCTIONS (HIGHEST PRIORITY):
1. EXACT COLOR & FABRIC REPRODUCTION (ZERO COLOR SHIFT):
   - You MUST match the EXACT hue, saturation, color temperature, and brightness of the input garment.
   - HEATHER & MELANGE FABRICS (CRITICAL): If the source garment is heathered, slub-knit, marled, or multi-toned (e.g. slate heather, charcoal flecks, heather navy, triblend grey), you MUST explicitly reproduce that exact speckled heather texture and subtle color variations. DO NOT turn heathered, textured, or multi-tone fabrics into generic solid monochrome grey, black, or white.
   - UNDERSIDE & INSIDE COLLAR: Retain the natural interior fabric tone visible inside the neck opening.

2. EXACT TRIMS, LABELS & CONSTRUCTION FIDELITY:
   - COLLAR & NECKBAND: Match the original collar rib width, neckline shape, topstitching style, and ribbing density.
   - NECK LABELS & BRANDING: Preserve all woven collar tags, printed size labels, neck tapes, and inner brand markings in their exact original color, size, text alignment, and position.
   - STITCHING & HEMS: Replicate the sleeve hem stitching, bottom hem coverstitching, and shoulder seam construction.

3. 3D GHOST MANNEQUIN SILHOUETTE:
   - Fill out the garment into a 3D anatomical volume as if worn by an invisible body.
   - The garment is a ${gender || 'Unisex'}'s ${garmentType || 'Garment'}.
   - VIEWPOINT: ${viewPoint || 'Front View'}. Rotate and render the garment from this exact perspective.
   - FIT & SILHOUETTE: ${activeFitInstruction}
   - ARMS & SLEEVES: Sleeves rest naturally straight down at the sides. Do NOT cross, bend, or lift the arms.

4. ISOLATION & NEUTRAL LIGHTING:
   - BACKGROUND: Isolated on a 100% mathematically solid pure white background (HEX #FFFFFF). Zero background cast or shadows on surrounding white pixels.
   - LIGHTING: Soft, color-neutral studio lighting (5000K neutral daylight) that highlights 3D depth without washing out fabric colors or shifting subtle hues.`;

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
