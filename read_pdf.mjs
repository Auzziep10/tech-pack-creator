import fs from 'fs';

const apiKey = "AIzaSyCU09BVfANflT7Le4Ynyf8S3zOKwpPr5XQ";

async function main() {
  const uri = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const base64Data = fs.readFileSync('Tech pack.pdf').toString('base64');
  
  const res = await fetch(uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Extract ALL field names, table headers, and layout elements from this PDF verbatim so I can understand its structure." },
          { inlineData: { mimeType: "application/pdf", data: base64Data } }
        ]
      }]
    })
  });
  const json = await res.json();
  console.log(json.candidates ? json.candidates[0].content.parts[0].text : json);
}
main();
