// Utility to dynamically load OpenCV.js from a CDN and manage its lifecycle

let openCvLoadingPromise: Promise<any> | null = null;

export const loadOpenCV = (): Promise<any> => {
  if (openCvLoadingPromise) return openCvLoadingPromise;

  openCvLoadingPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).cv) {
      resolve((window as any).cv);
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.5.4/opencv.js';
    script.async = true;

    script.onload = () => {
      // OpenCV.js loads asynchronously. We need to wait for its runtime to be ready.
      const checkCV = () => {
        if ((window as any).cv && (window as any).cv.Mat) {
          resolve((window as any).cv);
        } else {
          setTimeout(checkCV, 50);
        }
      };
      checkCV();
    };

    script.onerror = () => {
      openCvLoadingPromise = null;
      reject(new Error('Failed to load OpenCV.js from CDN.'));
    };

    document.body.appendChild(script);
  });

  return openCvLoadingPromise;
};

export interface Point {
  x: number;
  y: number;
}

export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

// Order points: top-left, top-right, bottom-right, bottom-left
export const orderPoints = (points: Point[]): Quad => {
  if (points.length !== 4) {
    throw new Error('Must provide exactly 4 points to order.');
  }

  // Sort by X coordinate
  const sortedX = [...points].sort((a, b) => a.x - b.x);
  
  // Leftmost points and rightmost points
  const leftMost = [sortedX[0], sortedX[1]];
  const rightMost = [sortedX[2], sortedX[3]];

  // Sort leftmost points by Y to get top-left and bottom-left
  const topLeft = leftMost[0].y < leftMost[1].y ? leftMost[0] : leftMost[1];
  const bottomLeft = leftMost[0].y < leftMost[1].y ? leftMost[1] : leftMost[0];

  // Sort rightmost points by Y to get top-right and bottom-right
  const topRight = rightMost[0].y < rightMost[1].y ? rightMost[0] : rightMost[1];
  const bottomRight = rightMost[0].y < rightMost[1].y ? rightMost[1] : rightMost[0];

  return { topLeft, topRight, bottomRight, bottomLeft };
};

// Perform perspective warp using OpenCV.js
export const warpPerspective = async (
  sourceCanvas: HTMLCanvasElement,
  quad: Quad,
  destWidth: number,
  destHeight: number
): Promise<HTMLCanvasElement> => {
  const cv = await loadOpenCV();

  const srcMat = cv.imread(sourceCanvas);
  const dstMat = new cv.Mat();

  // Source coordinates array
  const srcCoords = [
    quad.topLeft.x, quad.topLeft.y,
    quad.topRight.x, quad.topRight.y,
    quad.bottomRight.x, quad.bottomRight.y,
    quad.bottomLeft.x, quad.bottomLeft.y
  ];

  // Destination coordinates array (flat rectangle)
  const dstCoords = [
    0, 0,
    destWidth, 0,
    destWidth, destHeight,
    0, destHeight
  ];

  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, srcCoords);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, dstCoords);

  // Get transformation matrix
  const M = cv.getPerspectiveTransform(srcTri, dstTri);

  // Warp perspective
  const dsize = new cv.Size(destWidth, destHeight);
  cv.warpPerspective(srcMat, dstMat, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  // Output to new canvas
  const destCanvas = document.createElement('canvas');
  destCanvas.width = destWidth;
  destCanvas.height = destHeight;
  cv.imshow(destCanvas, dstMat);

  // Clean up memory
  srcMat.delete();
  dstMat.delete();
  srcTri.delete();
  dstTri.delete();
  M.delete();

  return destCanvas;
};

// Auto-detect document contour using OpenCV.js
export const detectDocumentContour = async (sourceCanvas: HTMLCanvasElement): Promise<Quad | null> => {
  try {
    const cv = await loadOpenCV();

    const src = cv.imread(sourceCanvas);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edged = new cv.Mat();

    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Gaussian Blur
    const ksize = new cv.Size(5, 5);
    cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

    // 3. Canny Edge Detection
    cv.Canny(blurred, edged, 75, 200, 3, false);

    // 4. Find Contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let documentContour = null;

    for (let i = 0; i < contours.size(); ++i) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      
      if (area > 1000) {
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * peri, true);

        // A document should have 4 corner points
        if (approx.rows === 4 && area > maxArea) {
          maxArea = area;
          documentContour = approx.clone();
        }
        approx.delete();
      }
    }

    // Clean up mats
    src.delete();
    gray.delete();
    blurred.delete();
    edged.delete();
    contours.delete();
    hierarchy.delete();

    if (documentContour) {
      const points: Point[] = [];
      for (let i = 0; i < 4; i++) {
        points.push({
          x: documentContour.data32S[i * 2],
          y: documentContour.data32S[i * 2 + 1]
        });
      }
      documentContour.delete();
      return orderPoints(points);
    }

    return null;
  } catch (e) {
    console.warn('Contour detection failed, using fallback coordinates', e);
    return null;
  }
};
