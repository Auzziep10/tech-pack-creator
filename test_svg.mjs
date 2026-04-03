import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

async function main() {
  const genAI = new GoogleGenerativeAI("AIzaSyCNKTlfiRkC5pvSyYazOp4FomEvtBI2Ivc");
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const prompt = `Act as an expert technical CAD designer. Perform a meticulous image trace on the outline of the garment and its prominent internal structural features. Create a pristine, flat black-and-white technical line-art CAD blueprint representation of the garment shown in the image, EXACTLY like a professional apparel tech pack.

CRITICAL INSTRUCTIONS:
1. You MUST output your design STRICTLY as a valid, raw HTML <svg> element.
2. The <svg> MUST contain highly detailed <path> elements with stroke="black" and fill="none" representing every contour, seam, pocket, and boundary of the exact garment in the photo.
3. Use a viewBox representing a clean square (e.g., viewBox="0 0 1000 1000") and scale your paths accordingly.
4. ONLY draw actual physical seams, stitches, and structural boundaries. No wrinkles, shading, or background.
5. DO NOT wrap your response in markdown blocks like \`\`\`svg. Output ONLY the raw <svg> string from start to finish.`;

  // Base64 encoding of a generic 10x10 grey PNG
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAXSURBVChTY2T4z8DAxEAEGE0ZTWGkKQIAD50E7c3QdGgAAAAASUVORK5CYII=";
  const result = await model.generateContent([prompt, { inlineData: { data: b64, mimeType: "image/png" } }]);
  const text = result.response.text();
  console.log("Returned:", text);
}
main().catch(console.error);
