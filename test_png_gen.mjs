import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyCU09BVfANflT7Le4Ynyf8S3zOKwpPr5XQ";

async function main() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "nano-banana-pro-preview" });
    const prompt = "Draw a small solid blue square and return it as a raw base64 encoded PNG.";
    const result = await model.generateContent([prompt]);
    
    console.log(JSON.stringify(result.response.candidates[0], null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
