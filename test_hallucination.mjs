import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyCNKTlfiRkC5pvSyYazOp4FomEvtBI2Ivc";

async function main() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });
    const prompt = "Act as an expert technical CAD designer. Perform a meticulous image trace on the outline of the garment and its prominent internal structural features. Create a pristine, flat black-and-white technical line-art CAD blueprint representation of the garment shown in the image, EXACTLY like a professional apparel tech pack. Include construction stitching and typical tech pack aesthetic, but DO NOT include measurement guide lines, arrows, or text callouts (those will be drawn manually).\n\nCRITICAL SPECIFICATIONS:\n1. The garment MUST look PERFECTLY IRONED AND FLAT. Do NOT draw any internal lines that represent wrinkles, fabric folds, or draping. ONLY draw actual physical seams, stitches, and structural boundaries.\n2. If the garment has a hood, the hood MUST be drawn UP and prominently visible, mimicking its exact structure from the photo.\n3. The completely blank space around the garment MUST BE PURE WHITE (#FFFFFF). Do NOT render a light grey background. Do not render drop shadows. THE BACKGROUND CAN ONLY BE PURE WHITE.\n\nKeep the output purely structural. Pure #FFFFFF white background, high contrast lines, no photorealistic shading. Return ONLY a valid base64 encoded raw PNG image representing the artwork, with absolutely no markdown formatting, no JSON, and no other text.";
    const result = await model.generateContent(prompt);
    console.log("Success!", result.response.text());
  } catch (err) {
    console.error(err);
  }
}

main();
