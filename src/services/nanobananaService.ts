async function resizeImage(imageUrl: string, maxSize = 1440): Promise<{ base64Data: string, mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas null'));
      // Keep it pristine white on transparent just in case
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) resolve({ mimeType: match[1], base64Data: match[2] });
      else reject(new Error("Failed to parse data URL"));
    };
    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = imageUrl;
  });
}

export async function vectorizeGarmentImage(imageUrl: string): Promise<string> {
  try {
    const { base64Data, mimeType } = await resizeImage(imageUrl);

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
