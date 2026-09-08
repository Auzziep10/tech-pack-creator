export type PngResolution = 'large' | '4k' | 'original';

export interface DownloadPngOptions {
  resolution?: PngResolution;
  targetDimension?: number;
  quality?: number;
}

/**
 * Loads an image from a URL, data URI, or blob URL with CORS protection.
 */
const loadImage = async (url: string): Promise<{ img: HTMLImageElement; cleanup?: () => void }> => {
  let objectUrlToCleanup: string | null = null;
  let srcToLoad = url;

  // If it's a remote URL, attempting a CORS fetch first produces a same-origin Blob URL,
  // preventing HTML5 canvas tainting errors.
  if (!url.startsWith('data:') && !url.startsWith('blob:')) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        objectUrlToCleanup = URL.createObjectURL(blob);
        srcToLoad = objectUrlToCleanup;
      }
    } catch {
      // If fetch fails (e.g. strict network/CORS), proceed with direct Image src
      srcToLoad = url;
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      resolve({
        img,
        cleanup: () => {
          if (objectUrlToCleanup) {
            URL.revokeObjectURL(objectUrlToCleanup);
          }
        },
      });
    };

    img.onerror = () => {
      // Fallback attempt without crossOrigin attribute
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        resolve({
          img: fallbackImg,
          cleanup: () => {
            if (objectUrlToCleanup) {
              URL.revokeObjectURL(objectUrlToCleanup);
            }
          },
        });
      };
      fallbackImg.onerror = (err) => {
        if (objectUrlToCleanup) {
          URL.revokeObjectURL(objectUrlToCleanup);
        }
        reject(new Error(`Failed to load image for download: ${err}`));
      };
      fallbackImg.src = url;
    };

    img.src = srcToLoad;
  });
};

/**
 * Downloads any image (data URL, storage URL, etc.) as a full-size, high-resolution PNG.
 * 
 * @param url - Source image URL or base64 data URI
 * @param baseFilename - Name of the target file (without .png extension, or with it)
 * @param options - Resolution settings ('large' = 2560px min, '4k' = 4096px, 'original' = 1:1)
 */
export const downloadAsLargePng = async (
  url: string,
  baseFilename: string,
  options: DownloadPngOptions = {}
): Promise<void> => {
  if (!url) {
    throw new Error('No image URL provided for download.');
  }

  const { resolution = 'large', targetDimension } = options;

  const { img, cleanup } = await loadImage(url);

  try {
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;

    if (!originalWidth || !originalHeight) {
      throw new Error('Invalid image dimensions.');
    }

    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    let desiredMaxDim: number;
    if (targetDimension) {
      desiredMaxDim = targetDimension;
    } else if (resolution === '4k') {
      desiredMaxDim = Math.max(originalWidth, originalHeight, 4096);
    } else if (resolution === 'large') {
      // Studio print quality: ensure at least 2560px on longest edge, but preserve original if already larger
      desiredMaxDim = Math.max(originalWidth, originalHeight, 2560);
    } else {
      // 'original' 1:1 native resolution
      desiredMaxDim = Math.max(originalWidth, originalHeight);
    }

    const currentMaxDim = Math.max(originalWidth, originalHeight);
    if (desiredMaxDim !== currentMaxDim) {
      const scale = desiredMaxDim / currentMaxDim;
      targetWidth = Math.round(originalWidth * scale);
      targetHeight = Math.round(originalHeight * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }

    // High quality bicubic resampling for ultra-sharp fabric and seam details
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate PNG blob from canvas.'));
      }, 'image/png');
    });

    const downloadBlobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadBlobUrl;

    const sanitizedBaseName = baseFilename.replace(/\.[^/.]+$/, '').trim() || 'techpack_garment';
    const suffix = resolution === '4k' ? '_4k' : '';
    link.download = `${sanitizedBaseName}${suffix}.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Give browser time to begin file transfer before revoking
    setTimeout(() => {
      URL.revokeObjectURL(downloadBlobUrl);
    }, 2000);
  } catch (canvasErr) {
    console.warn('Canvas export failed, falling back to direct blob download:', canvasErr);
    // Fallback: download raw blob or URL with .png extension
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const fallbackBlobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fallbackBlobUrl;
      const sanitizedBaseName = baseFilename.replace(/\.[^/.]+$/, '').trim() || 'techpack_garment';
      link.download = `${sanitizedBaseName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(fallbackBlobUrl), 2000);
    } catch {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFilename.replace(/\.[^/.]+$/, '')}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } finally {
    cleanup?.();
  }
};
