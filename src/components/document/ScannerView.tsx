import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RotateCw, Crop, Sparkles, Wand2, FileText, Check, AlertTriangle, ArrowRight } from 'lucide-react';
import { loadOpenCV, detectDocumentContour, warpPerspective } from '../../utils/opencv';
import type { Quad } from '../../utils/opencv';
import { applyFilter } from '../../utils/imageFilters';
import type { FilterType } from '../../utils/imageFilters';
import { useOcr } from '../../hooks/useOcr';
import { documentService } from '../../services/documentService';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';

type ScanStep = 'capture' | 'crop' | 'filter' | 'ocr' | 'saved';

export const ScannerView: React.FC = () => {
  const { user } = useAuth();
  const { incrementUsage } = useSubscription();
  const [step, setStep] = useState<ScanStep>('capture');
  
  // Camera & Capture State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [capturedImage, setCapturedImage] = useState<string>(''); // base64
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Crop State
  const [isOpenCvLoaded, setIsOpenCvLoaded] = useState(false);
  const [quadPoints, setQuadPoints] = useState<Quad>({
    topLeft: { x: 50, y: 50 },
    topRight: { x: 350, y: 50 },
    bottomRight: { x: 350, y: 450 },
    bottomLeft: { x: 50, y: 450 },
  });
  const [imageSize, setImageSize] = useState({ width: 400, height: 500 });
  const [draggedCorner, setDraggedCorner] = useState<keyof Quad | null>(null);
  const cropContainerRef = useRef<HTMLDivElement | null>(null);

  // Filter State
  const [flatCanvas, setFlatCanvas] = useState<HTMLCanvasElement | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('enhance');
  const [filteredImage, setFilteredImage] = useState<string>(''); // base64

  // OCR State
  const { performOcr, loading: ocrLoading, progress: ocrProgress } = useOcr();
  const [extractedText, setExtractedText] = useState('');

  // Save State
  const [docName, setDocName] = useState('Scanned Document');
  const [isSaving, setIsSaving] = useState(false);
  const [isCropping, setIsCropping] = useState(false);

  // Load OpenCV on demand when crop step starts
  useEffect(() => {
    if (step === 'crop' && !isOpenCvLoaded) {
      loadOpenCV()
        .then(() => setIsOpenCvLoaded(true))
        .catch(err => console.error('Failed to load OpenCV.js:', err));
    }
  }, [step, isOpenCvLoaded]);

  // Start Camera
  const startCamera = async () => {
    setIsCameraActive(true);
    setCapturedImage('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Failed to start camera:', err);
      alert('Camera access denied or unavailable.');
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsCameraActive(false);
  };

  // Capture Photo
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !stream) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setCapturedImage(dataUrl);
    stopCamera();

    // Move to crop step
    setStep('crop');
    
    // Initialize points and run edge detection
    setImageSize({ width: canvas.width, height: canvas.height });
    
    // Set default points (in case edge detection fails)
    const w = canvas.width;
    const h = canvas.height;
    const defaultQuad: Quad = {
      topLeft: { x: w * 0.1, y: h * 0.1 },
      topRight: { x: w * 0.9, y: h * 0.1 },
      bottomRight: { x: w * 0.9, y: h * 0.9 },
      bottomLeft: { x: w * 0.1, y: h * 0.9 },
    };
    
    setQuadPoints(defaultQuad);

    // Run auto contour detection if OpenCV is loaded
    if (isOpenCvLoaded) {
      setTimeout(async () => {
        const detected = await detectDocumentContour(canvas);
        if (detected) {
          setQuadPoints(detected);
        }
      }, 100);
    }
  };

  // Handle Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setCapturedImage(dataUrl);
      
      // Load image to get dimensions
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);

        setStep('crop');
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });

        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const defaultQuad: Quad = {
          topLeft: { x: w * 0.1, y: h * 0.1 },
          topRight: { x: w * 0.9, y: h * 0.1 },
          bottomRight: { x: w * 0.9, y: h * 0.9 },
          bottomLeft: { x: w * 0.1, y: h * 0.9 },
        };
        setQuadPoints(defaultQuad);

        if (isOpenCvLoaded) {
          detectDocumentContour(canvas).then(detected => {
            if (detected) setQuadPoints(detected);
          });
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // Interactive Crop Handle Dragging
  const handlePointerDown = (corner: keyof Quad) => {
    setDraggedCorner(corner);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggedCorner || !cropContainerRef.current) return;

    const rect = cropContainerRef.current.getBoundingClientRect();
    
    // Calculate relative coordinates (0 to 1)
    const xRatio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const yRatio = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

    // Convert back to image space
    const x = xRatio * imageSize.width;
    const y = yRatio * imageSize.height;

    setQuadPoints(prev => ({
      ...prev,
      [draggedCorner]: { x, y },
    }));
  };

  const handlePointerUp = () => {
    setDraggedCorner(null);
  };

  // Perform Crop (Warp Perspective)
  const applyCrop = async () => {
    if (!capturedImage || isCropping) return;
    setIsCropping(true);

    const img = new Image();
    img.src = capturedImage;
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(img, 0, 0);

    // Target dimensions for A4 aspect ratio
    const destWidth = 800;
    const destHeight = 1130;

    // Wrap in setTimeout to yield the thread and prevent page hangs
    setTimeout(async () => {
      try {
        let warpedCanvas: HTMLCanvasElement;
        if (isOpenCvLoaded) {
          warpedCanvas = await warpPerspective(canvas, quadPoints, destWidth, destHeight);
        } else {
          // Fallback: real rectangular crop using the bounding box of the user's selected quadPoints
          const minX = Math.max(0, Math.min(quadPoints.topLeft.x, quadPoints.bottomLeft.x));
          const minY = Math.max(0, Math.min(quadPoints.topLeft.y, quadPoints.topRight.y));
          const maxX = Math.min(img.naturalWidth, Math.max(quadPoints.topRight.x, quadPoints.bottomRight.x));
          const maxY = Math.min(img.naturalHeight, Math.max(quadPoints.bottomLeft.y, quadPoints.bottomRight.y));

          const cropW = Math.max(10, maxX - minX);
          const cropH = Math.max(10, maxY - minY);

          warpedCanvas = document.createElement('canvas');
          warpedCanvas.width = destWidth;
          warpedCanvas.height = destHeight;
          const wCtx = warpedCanvas.getContext('2d');
          if (wCtx) {
            wCtx.drawImage(img, minX, minY, cropW, cropH, 0, 0, destWidth, destHeight);
          }
        }

        setFlatCanvas(warpedCanvas);
        
        // Apply default enhancement filter
        const filtered = applyFilter(warpedCanvas, selectedFilter);
        setFilteredImage(filtered.toDataURL('image/jpeg'));
        
        setStep('filter');
      } catch (err) {
        console.error('Warp perspective failed:', err);
        alert('Failed to warp document perspective.');
      } finally {
        setIsCropping(false);
      }
    }, 50);
  };

  // Handle Filter Change
  const handleFilterChange = (filter: FilterType) => {
    setSelectedFilter(filter);
    if (flatCanvas) {
      const filtered = applyFilter(flatCanvas, filter);
      setFilteredImage(filtered.toDataURL('image/jpeg'));
    }
  };

  // Perform OCR
  const handleOcr = async () => {
    if (!filteredImage) return;
    
    // Get blob of filtered image
    const response = await fetch(filteredImage);
    const blob = await response.blob();

    try {
      const text = await performOcr(blob, { useGoogleVision: false });
      setExtractedText(text);
      setStep('ocr');
    } catch (e: any) {
      alert(e.message || 'OCR Failed.');
    }
  };

  // Save Scanned Document
  const saveDocument = async () => {
    if (!filteredImage) return;
    setIsSaving(true);

    try {
      const response = await fetch(filteredImage);
      const blob = await response.blob();

      // Create a document with a single page
      await documentService.createDocument(
        user,
        docName,
        'application/pdf',
        [{ image: blob, pageNumber: 1 }]
      );

      incrementUsage('scannedPages');
      setStep('saved');
    } catch (e) {
      console.error(e);
      alert('Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto bg-surface-variant/10 border border-surface-variant/40 rounded-3xl p-6 shadow-sm">
      
      {/* 1. Steps Navigation */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
        {[
          { label: 'Capture', value: 'capture' },
          { label: 'Crop & Flatten', value: 'crop' },
          { label: 'Enhance', value: 'filter' },
          { label: 'OCR (Optional)', value: 'ocr' },
          { label: 'Save', value: 'saved' },
        ].map((s, idx) => (
          <React.Fragment key={s.value}>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.value
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-variant text-outline'
              }`}>
                {idx + 1}
              </div>
              <span className={`text-xs font-semibold ${step === s.value ? 'text-primary' : 'text-outline'}`}>
                {s.label}
              </span>
            </div>
            {idx < 4 && <ArrowRight size={14} className="text-outline/30 flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* 2. Step Workspaces */}
      
      {/* STEP 1: CAPTURE */}
      {step === 'capture' && (
        <div className="flex flex-col items-center gap-6">
          {isCameraActive ? (
            <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-lg border border-outline/20">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {/* Document scanning guide overlay */}
              <div className="absolute inset-8 border border-dashed border-white/40 rounded-2xl pointer-events-none flex items-center justify-center">
                <span className="text-xs text-white/50 bg-black/40 px-2.5 py-1 rounded-full">Align document here</span>
              </div>
              
              <div className="absolute bottom-6 inset-x-0 flex justify-center gap-4">
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 rounded-full bg-white border-4 border-primary/20 flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-lg"
                />
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md aspect-[3/4] border-2 border-dashed border-outline/20 rounded-3xl bg-surface flex flex-col items-center justify-center text-center p-8">
              <Camera size={48} className="text-outline/40 mb-4" />
              <h3 className="font-bold text-on-surface mb-2">Scan Document</h3>
              <p className="text-xs text-outline mb-6 max-w-xs">Scan any document, receipt, or whiteboard using your camera, or upload an image.</p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                <button
                  onClick={startCamera}
                  className="flex-1 py-3 bg-primary text-on-primary hover:bg-primary/90 rounded-full font-medium transition text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  <Camera size={16} />
                  Use Camera
                </button>
                
                <label className="flex-1 py-3 border border-outline/30 hover:bg-surface-variant/30 text-on-surface rounded-full font-medium transition text-sm flex items-center justify-center gap-2 cursor-pointer">
                  <Upload size={16} />
                  <span>Upload</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: CROP & FLATTEN */}
      {step === 'crop' && capturedImage && (
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h3 className="font-bold text-on-surface">Adjust Crop Borders</h3>
            <p className="text-xs text-outline mt-1">Drag the 4 corner handles to align with the edges of your document.</p>
            {!isOpenCvLoaded && (
              <p className="text-[10px] text-error flex items-center gap-1 justify-center mt-1">
                <AlertTriangle size={10} /> OpenCV.js still loading... using rectangular crop.
              </p>
            )}
          </div>

          {/* Interactive Cropper */}
          <div 
            ref={cropContainerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative max-w-md w-full bg-black rounded-2xl overflow-hidden select-none"
            style={{ touchAction: 'none' }}
          >
            <img 
              src={capturedImage} 
              alt="Source" 
              className="w-full h-auto pointer-events-none block"
            />
            
            {/* Draggable handles rendered proportionally */}
            {cropContainerRef.current && (
              <>
                {/* SVG overlay to draw the quad outline */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <polygon
                    points={`
                      ${(quadPoints.topLeft.x / imageSize.width) * 100}%, ${(quadPoints.topLeft.y / imageSize.height) * 100}%
                      ${(quadPoints.topRight.x / imageSize.width) * 100}%, ${(quadPoints.topRight.y / imageSize.height) * 100}%
                      ${(quadPoints.bottomRight.x / imageSize.width) * 100}%, ${(quadPoints.bottomRight.y / imageSize.height) * 100}%
                      ${(quadPoints.bottomLeft.x / imageSize.width) * 100}%, ${(quadPoints.bottomLeft.y / imageSize.height) * 100}%
                    `}
                    fill="rgba(103, 80, 164, 0.15)"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                  />
                </svg>

                {/* Corner handles */}
                {(Object.keys(quadPoints) as Array<keyof Quad>).map((corner) => {
                  const pt = quadPoints[corner];
                  const left = `${(pt.x / imageSize.width) * 100}%`;
                  const top = `${(pt.y / imageSize.height) * 100}%`;

                  return (
                    <div
                      key={corner}
                      onPointerDown={() => handlePointerDown(corner)}
                      className="absolute w-8 h-8 -ml-4 -mt-4 flex items-center justify-center cursor-grab active:cursor-grabbing z-20 touch-none"
                      style={{ left, top }}
                    >
                      <div className="w-5 h-5 rounded-full bg-primary border-2 border-white shadow-md flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => setStep('capture')}
              className="flex-1 py-2.5 border border-outline/30 hover:bg-surface-variant/30 text-on-surface rounded-full text-sm font-semibold transition"
            >
              Retake
            </button>
            <button
              onClick={applyCrop}
              disabled={isCropping}
              className="flex-1 py-2.5 bg-primary text-on-primary hover:bg-primary/95 disabled:opacity-50 rounded-full text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm"
            >
              {isCropping ? (
                <>
                  <RotateCw size={14} className="animate-spin" />
                  Cropping...
                </>
              ) : (
                <>
                  <Crop size={14} />
                  Crop & Flatten
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: ENHANCE / FILTERS */}
      {step === 'filter' && filteredImage && (
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h3 className="font-bold text-on-surface">Apply Filter</h3>
            <p className="text-xs text-outline mt-1">Enhance readability by applying document filters.</p>
          </div>

          <div className="max-w-xs w-full bg-white rounded-2xl p-3 border border-outline/20 shadow-md">
            <img src={filteredImage} alt="Enhanced document" className="w-full h-auto object-contain rounded-xl" />
          </div>

          {/* Filter Selection Grid */}
          <div className="grid grid-cols-4 gap-2 w-full max-w-sm">
            {[
              { id: 'none', label: 'Original', icon: Sparkles },
              { id: 'enhance', label: 'Enhance', icon: Wand2 },
              { id: 'grayscale', label: 'Grayscale', icon: RotateCw },
              { id: 'mono', label: 'B&W Mono', icon: FileText },
            ].map((filt) => (
              <button
                key={filt.id}
                onClick={() => handleFilterChange(filt.id as FilterType)}
                className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition ${
                  selectedFilter === filt.id
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'bg-surface text-on-surface border-outline/20 hover:bg-surface-variant/30'
                }`}
              >
                <filt.icon size={14} />
                <span>{filt.label}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={handleOcr}
              className="flex-1 py-2.5 bg-secondary text-on-secondary hover:bg-secondary/90 rounded-full text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <FileText size={14} />
              Extract Text
            </button>
            <button
              onClick={() => setStep('ocr')}
              className="flex-1 py-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-full text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm"
            >
              Next
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: OCR (TEXT EXTRACTION) */}
      {step === 'ocr' && (
        <div className="flex flex-col items-center gap-6">
          <div className="text-center w-full max-w-md">
            <h3 className="font-bold text-on-surface">Extract Text (OCR)</h3>
            <p className="text-xs text-outline mt-1">
              {extractedText ? 'Extracted text is shown below.' : 'Extract text from the scanned document using Tesseract.js.'}
            </p>
          </div>

          {ocrLoading ? (
            <div className="w-full max-w-md flex flex-col items-center justify-center bg-surface border border-outline/20 rounded-2xl p-8">
              <RotateCw size={32} className="animate-spin text-primary mb-4" />
              <p className="text-sm font-semibold text-on-surface">Running OCR extraction...</p>
              <p className="text-xs text-outline mt-1">{Math.round(ocrProgress * 100)}% completed</p>
            </div>
          ) : extractedText ? (
            <div className="w-full max-w-md space-y-4">
              <textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                rows={10}
                className="w-full px-4 py-3 rounded-2xl bg-surface border border-outline/30 focus:border-primary focus:outline-none text-on-surface font-mono text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(extractedText);
                  alert('Copied to clipboard!');
                }}
                className="w-full py-2 border border-outline/30 hover:bg-surface-variant/30 text-on-surface text-xs font-semibold rounded-xl transition"
              >
                Copy Text
              </button>
            </div>
          ) : (
            <div className="w-full max-w-md border-2 border-dashed border-outline/20 rounded-3xl bg-surface p-8 text-center">
              <FileText size={36} className="text-outline/40 mb-3 mx-auto" />
              <p className="font-semibold text-on-surface-variant text-sm mb-1">No text extracted yet</p>
              <p className="text-xs text-outline mb-6">Click extract to run local OCR engine.</p>
              <button
                onClick={handleOcr}
                className="px-6 py-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-full text-sm font-semibold transition"
              >
                Extract Text
              </button>
            </div>
          )}

          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => setStep('filter')}
              className="flex-1 py-2.5 border border-outline/30 hover:bg-surface-variant/30 text-on-surface rounded-full text-sm font-semibold transition"
            >
              Back
            </button>
            <button
              onClick={() => setStep('saved')}
              className="flex-1 py-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-full text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm"
            >
              Continue
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: SAVE */}
      {step === 'saved' && (
        <div className="flex flex-col items-center gap-6">
          <div className="text-center w-full max-w-md">
            <h3 className="font-bold text-on-surface">Save Document</h3>
            <p className="text-xs text-outline mt-1">Specify a name to save the processed PDF document.</p>
          </div>

          <div className="w-full max-w-md bg-surface border border-outline/20 rounded-3xl p-6 space-y-4 shadow-sm">
            <div>
              <label className="block text-xs font-medium text-outline mb-1.5">Document Name</label>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/30 border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={saveDocument}
              disabled={isSaving || !docName.trim()}
              className="w-full py-3 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 rounded-full font-semibold transition flex items-center justify-center gap-2 shadow-sm"
            >
              {isSaving ? (
                <>
                  <RotateCw size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Save Scanned PDF
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              setStep('capture');
              setCapturedImage('');
              setFilteredImage('');
              setExtractedText('');
              setDocName('Scanned Document');
              setFlatCanvas(null);
            }}
            className="py-2 px-6 border border-outline/30 hover:bg-surface-variant/30 text-on-surface text-xs font-semibold rounded-xl transition"
          >
            Scan Another Document
          </button>
        </div>
      )}

    </div>
  );
};
