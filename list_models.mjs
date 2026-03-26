import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyCU09BVfANflT7Le4Ynyf8S3zOKwpPr5XQ";

async function main() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
