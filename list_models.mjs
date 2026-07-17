import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyCNKTlfiRkC5pvSyYazOp4FomEvtBI2Ivc";

async function main() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
