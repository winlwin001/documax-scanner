// Custom Canvas-based image filters for document enhancement

export type FilterType = 'none' | 'enhance' | 'grayscale' | 'mono';

export const applyFilter = (
  sourceCanvas: HTMLCanvasElement,
  filter: FilterType
): HTMLCanvasElement => {
  const destCanvas = document.createElement('canvas');
  destCanvas.width = sourceCanvas.width;
  destCanvas.height = sourceCanvas.height;
  
  const ctx = destCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  // Draw original image
  ctx.drawImage(sourceCanvas, 0, 0);

  if (filter === 'none') {
    return destCanvas;
  }

  const imageData = ctx.getImageData(0, 0, destCanvas.width, destCanvas.height);
  const data = imageData.data;

  if (filter === 'grayscale') {
    // Grayscale: Luminosity method
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = gray;     // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
    }
  } else if (filter === 'enhance') {
    // Contrast enhancement
    const contrast = 30; // Contrast factor (-100 to 100)
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    
    for (let i = 0; i < data.length; i += 4) {
      // 1. Adjust contrast
      data[i] = factor * (data[i] - 128) + 128;     // R
      data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
      data[i + 2] = factor * (data[i + 2] - 128) + 128; // B

      // 2. Slight brightness boost
      const brightness = 15;
      data[i] = Math.min(255, Math.max(0, data[i] + brightness));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness));
    }
  } else if (filter === 'mono') {
    // Black and White Binarization (thresholding)
    // We calculate average intensity first, then apply threshold
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Threshold at 128
      const binary = gray >= 128 ? 255 : 0;
      data[i] = binary;
      data[i + 1] = binary;
      data[i + 2] = binary;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return destCanvas;
};
