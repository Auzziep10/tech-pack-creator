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

    const normalizedGarment = (garmentType || '').toLowerCase();
    const isHeadwear = ['hats', 'hat', 'cap', 'headwear', 'beanie', 'snapback', 'trucker', 'bucket hat', 'visor'].some(h => 
      normalizedGarment.includes(h)
    );
    const isBottoms = ['pants', 'shorts', 'skirt', 'trousers', 'jeans', 'sweatpants', 'leggings', 'jogger', 'boxer', 'underwear'].some(b =>
      normalizedGarment.includes(b)
    );

    let prompt = '';

    if (isHeadwear) {
      const HAT_FIT_DESCRIPTIONS: Record<string, string> = {
        Structured: "STRUCTURED CROWN: Firm, reinforced buckram front panels maintaining a crisp, rigid, upright 3D crown silhouette.",
        "High Crown": "HIGH CROWN PROFILE: Tall, bold, upright 5-panel or 6-panel structured crown stance with pronounced vertical presence and flat/curved visor.",
        "Mid Profile": "MID PROFILE CROWN: Balanced, modern structured crown curvature suitable for classic snapbacks and trucker hats.",
        "Low Profile": "LOW PROFILE / UNSTRUCTURED: Relaxed, soft, dad-hat silhouette that conforms naturally to the head shape without rigid buckram.",
        Standard: "STANDARD 3D HAT PROFILE: Classic balanced 3D cap/hat silhouette holding its natural shape cleanly as if displayed on a retail head form.",
        Fitted: "FITTED CROWN: Snug, contoured 3D dome silhouette.",
        Loose: "RELAXED PROFILE: Soft, relaxed crown silhouette.",
        Boxy: "STRUCTURED HIGH CROWN: Tall, boxy, upright front crown with crisp panels.",
        Athleisure: "PERFORMANCE RUNNING / ACTIVE CAP: Sleek lightweight aerodynamic 3D profile."
      };

      const hatFitInstruction = fitStyle && HAT_FIT_DESCRIPTIONS[fitStyle] ? HAT_FIT_DESCRIPTIONS[fitStyle] : HAT_FIT_DESCRIPTIONS['Standard'];

      let viewInstruction = '';
      if (viewPoint === 'Back View') {
        viewInstruction = `* BACK VIEW RENDERING: Render the hat from directly behind.
   - Display the rear crown panels, the rear keyhole arch cutout opening, the closure mechanism (snapback plastic studs, strapback with buckle/clasp, velcro, or closed fitted back), and the interior sweatband/lining visible through the rear arch opening.
   - Top squatchee button visible at the apex.`;
      } else if (viewPoint === 'Right Side View' || viewPoint === 'Left Side View') {
        viewInstruction = `* SIDE PROFILE VIEW RENDERING (${viewPoint}): Render the hat in a clean 90-degree side profile view.
   - Show the forward curve of the visor/bill, the crown slope and profile height, side panel seams, side eyelet ventilation holes, side embroidery/patch if present, and the side profile of the rear closure.`;
      } else {
        viewInstruction = `* FRONT VIEW RENDERING (CRITICAL STRICT REQUIREMENT): Direct frontal studio view of the cap.
   - SOLID UNBROKEN FRONT CROWN: The front crown panels MUST be 100% SOLID, CONTINUOUS, AND UNBROKEN FABRIC.
   - ABSOLUTELY ZERO HOLES OR CAVITIES: DO NOT cut any hole, arched cutout, keyhole opening, or hollow cavity into the front crown. There is NO hollow collar or neck opening on a hat!
   - REAR CLOSURE IS INVISIBLE: The snapback strap, rear arch, buckle, and adjustment mechanism belong strictly on the REAR of the hat and MUST NOT appear on, inside, or through the front panels. The rear closure is completely hidden behind the solid front crown.
   - BRIM / VISOR: Visor/bill extends forward horizontally towards the viewer with accurate 3D curvature, thickness, and stitching rows.
   - TOP BUTTON & EYELETS: Top squatchee button centered at the peak; eyelets positioned accurately on panels.
   - TRIMS & ACCESSORIES: If there is a rope / cord along the base of the crown above the visor, render it resting neatly and taut across the base seam. If there is a visor sticker (e.g. metallic/foil brand sticker), woven patch, or embroidered logo, reproduce it crisply in its exact location and orientation with sharp details.`;
      }

      prompt = `TASK: Professional 3D E-Commerce Headwear Product Render (Invisible Display Head Form / Ghost Mannequin)

CRITICAL HEADWEAR & APPAREL RULES (ABSOLUTE HIGHEST PRIORITY):
1. THIS IS A HAT / CAP / HEADWEAR (NOT A SHIRT, TORSO, OR BODY GARMENT):
   - ABSOLUTELY FORBIDDEN: NO SLEEVES, NO ARMS, NO CHEST, NO WAIST, NO COLLAR, NO NECK OPENING, AND NO TORSO!
   - Under NO circumstances should any clothing body parts, human mannequins, or hollow neck collars be rendered.

2. VIEWPOINT DIRECTIVES (${viewPoint || 'Front View'}):
${viewInstruction}

3. 3D HEAD FORM PROPORTIONS & VOLUME:
   - Fill out the hat into a full 3D dome volume as if worn on an invisible display head form.
   - ${hatFitInstruction}
   - Maintain the crown panel structure (5-panel, 6-panel, or pinch front), seam stitching, and crown shape without denting, wrinkling, or collapsing.

4. EXACT COLOR, TEXTURE & TRIMS REPRODUCTION (ZERO COLOR SHIFT):
   - Match the EXACT hue, saturation, color temperature, and brightness of the input hat.
   - Accurately reproduce fabric textures (cotton twill, polyester mesh on trucker hats, corduroy, wool, nylon, or knit).
   - UNDERSIDE / UNDERBRIM: Retain the natural undervisor fabric tone and texture.
   - TRIMS & LABELS: Preserve all ropes, eyelets, top buttons, brand stickers, sweatband details, and embroidery stitching with 100% fidelity.

5. ISOLATION & COMMERCIAL STUDIO LIGHTING:
   - BACKGROUND: Isolated on a 100% mathematically solid pure white background (HEX #FFFFFF). Zero background cast or shadows on surrounding white pixels.
   - LIGHTING: Soft, color-neutral 3D commercial product photography lighting (5000K daylight) highlighting the 3D volume, fabric texture, and panel stitching.`;
    } else if (isBottoms) {
      const BOTTOM_FIT_DESCRIPTIONS: Record<string, string> = {
        Fitted: "FITTED / SLIM SILHOUETTE: Tailored slim fit through waist, hips, thighs, and legs.",
        Standard: "STANDARD SILHOUETTE: Classic regular fit with natural 3D leg drape.",
        Loose: "LOOSE / RELAXED SILHOUETTE: Relaxed roomy fit through hips and legs with fluid drape.",
        Boxy: "WIDE LEG / BAGGY SILHOUETTE: Bold straight wide-leg cut dropping vertically from hips to hem without leg taper.",
        Athleisure: "ATHLETIC SILHOUETTE: Performance jogger / activewear fit with tapered cuffs and ergonomic drape."
      };
      const bottomFitInstruction = fitStyle && BOTTOM_FIT_DESCRIPTIONS[fitStyle] ? BOTTOM_FIT_DESCRIPTIONS[fitStyle] : BOTTOM_FIT_DESCRIPTIONS['Standard'];

      prompt = `TASK: Professional 3D Invisible Ghost Mannequin Apparel Render (Ultra-High Precision 3D Volume)

CRITICAL BOTTOMS / PANTS RULES (HIGHEST PRIORITY):
1. THIS IS A LOWER-BODY GARMENT (${garmentType || 'Pants'}):
   - ABSOLUTELY NO SLEEVES, NO ARMS, NO CHEST, NO SHOULDERS, NO NECK COLLAR!
   - Render the garment as worn by an invisible lower human body (waist, hips, thighs, and legs).

2. HOLLOW WAISTBAND OPENING:
   - Render the 3D hollow interior dimension of the waistband opening at the top, showing the inside back waistband, size label, or brand tags visible inside.

3. 3D GHOST MANNEQUIN EFFECT & FIT PROPORTIONS:
   - Fill out the pants/shorts into 3D anatomical leg volume.
   - SPECIFIC FIT & SILHOUETTE DIRECTIVE: ${bottomFitInstruction}
   - VIEWPOINT: ${viewPoint || 'Front View'}.
   ${viewPoint === 'Back View' 
     ? 'Show the back waistband, back pockets, yoke seams, and back leg silhouettes.' 
     : 'Show the front waistband button/drawstrings, front fly zipper, front pockets, and front leg silhouettes.'}
   - Legs hang naturally downward with clean 3D volume.

4. EXACT COLOR & FABRIC REPRODUCTION (ZERO COLOR SHIFT):
   - Match the EXACT hue, saturation, and brightness of the input garment.
   - Preserve all denim washes, textures, distresses, belt loops, rivets, stitching, and hems.

5. ISOLATION & NEUTRAL LIGHTING:
   - BACKGROUND: Isolated on a 100% mathematically solid pure white background (HEX #FFFFFF). Zero background cast or shadows on surrounding white pixels.
   - LIGHTING: Soft, color-neutral 3D studio lighting (5000K neutral daylight) that highlights 3D body depth without washing out fabric colors.`;
    } else {
      const FIT_DESCRIPTIONS: Record<string, string> = {
        Fitted: "FITTED SILHOUETTE: Form-fitting tailored style hugging body contours snugly with defined waist taper, tapered sleeves, and sleek athletic lines.",
        Standard: "STANDARD SILHOUETTE: Classic regular fit with a natural, comfortable 3D drape around the body without being tight or oversized.",
        Loose: "LOOSE SILHOUETTE: Relaxed, comfortable fit with soft fluid drape through chest and waist while maintaining natural body lines.",
        Boxy: "BOXY / OVERSIZED STREETWEAR SILHOUETTE (CRITICAL STRICT REQUIREMENT): Distinct wide 90s streetwear boxy cut. Render wide dropped shoulders, extra-wide chest breadth, and STRAIGHT VERTICAL SIDE SEAMS dropping straight down from armpits to hem without ANY waist taper, body curvature, or waist pinching. The bottom hem and ribbing MUST be wide, straight, and uncinched, matching the broad chest width across a rectangular 3D torso stance.",
        Athleisure: "ATHLEISURE SILHOUETTE: Streamlined athletic lifestyle fit engineered for lightweight performance drape, smooth ergonomic contouring, and activewear proportions."
      };

      const activeFitInstruction = fitStyle && FIT_DESCRIPTIONS[fitStyle] ? FIT_DESCRIPTIONS[fitStyle] : FIT_DESCRIPTIONS['Standard'];

      prompt = `TASK: Professional 3D Invisible Ghost Mannequin Apparel Render (Ultra-High Precision 3D Volume)

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
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image" });

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
