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
    const { base64Data, mimeType, gender, garmentType, viewPoint } = req.body;

    if (!base64Data || !mimeType) {
       return res.status(400).json({ error: 'Missing base64Data or mimeType payload.' });
    }

    // Garment-specific flat-lay styling directives (e-commerce catalog standard)
    const GARMENT_FLATLAY_STYLES: Record<string, string> = {
      'T-Shirt': "T-SHIRT FLAT-LAY: Spread short sleeves symmetrically outward to the sides at a natural 25-35 degree downward angle. The body is a flat 2D rectangular spread with a straight bottom hem, lying completely flat on the surface.",
      'Long Sleeve': "LONG SLEEVE FLAT-LAY (STRICT REQUIREMENT): The long sleeves MUST NOT hang down vertically along the sides of the torso! Spread both long sleeves symmetrically OUTWARD away from the torso at an elegant 35-45 degree angle, lying completely flat against the tabletop surface (or neatly and symmetrically folded at the forearms in classic luxury e-commerce catalog flat-lay styling).",
      'Hoodie': "HOODIE FLAT-LAY: Lay the torso and sleeves completely flat on the tabletop. Symmetrically spread the sleeves outward at a 35-45 degree angle. Smoothly flatten the hood above the collar flat against the surface, with drawstrings resting naturally and straight on the flat chest.",
      'Polo': "POLO FLAT-LAY: The ribbed polo collar and button placket lie pressed completely flat against the chest. Short sleeves extend outward symmetrically flat to the sides.",
      'Pants': "PANTS FLAT-LAY: Lay both pant legs straight, parallel, and completely flat on the surface. The waistband is pressed straight across horizontally.",
      'Shorts': "SHORTS FLAT-LAY: Laid flat, legs parallel, straight bottom leg openings, waistband straight and smooth.",
      'Quarter Zip': "QUARTER ZIP FLAT-LAY: Stand collar is pressed flat, zipper lies flat down the center chest, long sleeves spread outward at a 35-45 degree angle.",
      'Tank Top': "TANK TOP FLAT-LAY: Sleeveless shoulder straps lie completely flat against the surface, armhole curves laid flat.",
      'Outerwear': "OUTERWEAR FLAT-LAY: Jacket laid completely flat, front zipper/buttons flat down the center, sleeves spread outward at 35-45 degrees.",
    };

    const specificGarmentDirective = garmentType && GARMENT_FLATLAY_STYLES[garmentType] 
      ? GARMENT_FLATLAY_STYLES[garmentType] 
      : "SPREAD SLEEVES FLAT: Symmetrically spread the sleeves outward away from the torso at a natural flat-lay angle (30-45 degrees), lying completely flat on the surface.";

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });
    const prompt = `PRIMARY TRANSFORMATION GOAL (ABSOLUTE HIGHEST PRIORITY):
TRANSFORM THE APPAREL SHOWN IN THE INPUT IMAGE FROM ITS CURRENT 3D BODY / MANNEQUIN FORM INTO A 100% AUTHENTIC 2D TABLETOP FLAT-LAY APPAREL PHOTOGRAPH (E-COMMERCE CATALOG BIRD'S-EYE OVERHEAD TOP-DOWN SHOT).

CRITICAL FLAT-LAY STYLING & POSE DIRECTIVES:
1. 100% TRUE 2D FLAT-LAY ON HORIZONTAL SURFACE:
   - The garment must be physically laid out completely flat on a smooth horizontal studio tabletop surface, neatly pressed and ironed flat.
   - DIRECT 90-DEGREE TOP-DOWN OVERHEAD PERSPECTIVE: The camera angle is directly straight down from above (bird's-eye view, perpendicular to the tabletop), exactly like product catalog flat-lays on SSENSE, Uniqlo, Zara, and Mr Porter.
   - ZERO 3D CHEST CURVATURE OR BODY VOLUME: The chest, stomach, and sides are pressed completely flat against the table. No athletic posture, no chest bulging, no 3D torso thickness, no tapered waist curves.

2. SLEEVE SPREAD & POSITIONING (CRITICAL):
   - ${specificGarmentDirective}
   - DO NOT let sleeves hang straight down vertically along the sides of the torso like on a standing mannequin! The sleeves MUST be spread outward away from the torso or neatly folded flat.

3. COLLAR & NECK (PRESSED FLAT):
   - The collar is pressed flat against the tabletop. The back collar ribbing is flat directly behind/under the front collar.
   - ABSOLUTELY NO 3D HOLLOW NECK CAVITY OR CYLINDRICAL HOLE: This is a 2D flat lay on a table, NOT a 3D hollow mannequin!

4. STRICT PROHIBITIONS & NEGATIVE INSTRUCTIONS (ZERO TOLERANCE):
   - ABSOLUTELY FORBIDDEN: DO NOT render an invisible ghost mannequin, 3D hollow mannequin, athletic torso stance, or floating 3D body form.
   - ABSOLUTELY FORBIDDEN: DO NOT leave sleeves hanging straight down hugging an invisible body.
   - ABSOLUTELY FORBIDDEN: DO NOT render a 3D hollow neck opening with internal cavity depth.
   - The output MUST look like a real physical garment lying flat on a table, photographed from straight above.

5. EXACT FABRIC, COLOR & DETAILS (MATCH INPUT SOURCE):
   - Exact same color, hue, saturation, and brightness as the input garment.
   - HEATHER / MELANGE: If the source garment is heathered, slub-knit, marled, or multi-toned, you MUST faithfully reproduce that exact heather/melange texture.
   - Exact collar labels, printed brand tags, neck tape, topstitching, ribbing, and seam construction.
   - Garment: ${gender || 'Unisex'}'s ${garmentType || 'Garment'}.
   - Viewpoint: ${viewPoint || 'Front View'}. Render the flat garment from this direct overhead angle.

6. ISOLATION & STUDIO LIGHTING:
   - Isolated on a 100% mathematically solid pure white background (HEX #FFFFFF).
   - Soft, balanced, diffused studio overhead lighting showing authentic fabric texture and stitching without harsh shadows.`;

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
        break;
      } catch (genErr: any) {
        const isTransient = genErr?.message?.includes('503') ||
                            genErr?.message?.includes('Service Unavailable') ||
                            genErr?.message?.includes('Deadline expired') ||
                            genErr?.message?.includes('504') ||
                            genErr?.message?.includes('429');
        if (isTransient && attempt < maxRetries) {
          console.warn(`[Flatlay API] Transient error (attempt ${attempt + 1}/${maxRetries + 1}):`, genErr.message);
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
    console.error("Flat-Lay Generation Error:", err);
    let errMsg = err.message || 'Internal Server Error';
    if (errMsg.includes('503') || errMsg.includes('Service Unavailable') || errMsg.includes('Deadline expired')) {
      errMsg = 'The Google AI image generation service is temporarily busy (503 Service Unavailable). Please click "Create Flat Lay Garment" again in a few moments to retry.';
    }
    return res.status(500).json({ error: errMsg });
  }
}
