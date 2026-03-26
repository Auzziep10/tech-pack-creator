export async function vectorizeGarmentImage(imageUrl: string): Promise<string> {
  try {
    let base64Data = imageUrl;
    let mimeType = "image/jpeg";

    if (imageUrl.startsWith("data:")) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    } else {
      // Handle if it's an http url or object url
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      mimeType = blob.type;
      const arrayBuffer = await blob.arrayBuffer();
      
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Data = window.btoa(binary);
    }

    const res = await fetch('/api/vectorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64Data, mimeType })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();
    return data.data;

  } catch (err) {
    console.error("Vectorization Error:", err);
    throw err;
  }
}
