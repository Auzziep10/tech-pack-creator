import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyCNKTlfiRkC5pvSyYazOp4FomEvtBI2Ivc";

async function main() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });
    const result = await model.generateContent("Say hello");
    console.log("Success!", result.response.text());
  } catch (err) {
    console.error(err);
  }
}

main();
