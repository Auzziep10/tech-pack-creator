export async function vectorizeGarmentImage(imageUrl: string, apiKey: string): Promise<string> {
  try {
    // Note: The specific endpoint and JSON payload structure might need to be adjusted
    // to perfectly match the Nano Banana Ultra documentation.
    const response = await fetch("https://api.nanobanana.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "ultra", // Specify the ultra model as requested by user
        prompt: "Create a pristine, flat black-and-white vector technical line-art CAD blueprint of this garment. Pure white background, high contrast lines, no photorealistic shading, just structural geometry.",
        image_url: imageUrl,
        response_format: "url"
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("NanoBanana API Error:", err);
      throw new Error(`Failed to vectorize: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Standard OpenAI/Replicate style response mapping
    if (data.url) return data.url;
    if (data.data && data.data[0] && data.data[0].url) return data.data[0].url;
    
    throw new Error("Could not parse image URL from NanoBanana response.");
  } catch (err) {
    console.error(err);
    throw err;
  }
}
