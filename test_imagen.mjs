const apiKey = "AIzaSyCU09BVfANflT7Le4Ynyf8S3zOKwpPr5XQ";

async function main() {
  try {
    const payloads = [
      { uri: `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateContent?key=${apiKey}` },
      { uri: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}` }
    ];
    for (const p of payloads) {
      const res = await fetch(p.uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "A tiny pink square." }] }]
        })
      });
      const json = await res.json();
      console.log(`URL: ${p.uri}`);
      console.log(json.error ? json.error : json.candidates[0].content.parts[0]);
    }
  } catch(e) { console.error(e); }
}

main();
