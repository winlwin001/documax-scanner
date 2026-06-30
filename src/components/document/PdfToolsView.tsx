import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Merge, Scissors, RotateCw, Type, PenTool, Lock, 
  Download, Upload, CheckCircle2, RefreshCw, Trash2 
} from 'lucide-react';
import { pdfUtils } from '../../utils/pdfUtils';

type PdfToolType = 'merge' | 'split' | 'rotate' | 'watermark' | 'sign' | 'encrypt' | 'compress';

export const PdfToolsView: React.FC = () => {
  const [activeTool, setActiveTool] = useState<PdfToolType>('merge');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFileName, setResultFileName] = useState('');

  // Tool Specific Options
  const [splitRange, setSplitRange] = useState('1');
  const [rotationAngle, setRotationAngle] = useState(90);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [encryptPassword, setEncryptPassword] = useState('');
  const [compressQuality, setCompressQuality] = useState(0.5); // 0.1 - 1.0

  // Signature Canvas Refs & State
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signPageNum, setSignPageNum] = useState(1);
  const [signX, setSignX] = useState(100);
  const [signY, setSignY] = useState(100);
  const [signW, setSignW] = useState(150);
  const [signH] = useState(60);

  // Clear signature canvas
  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Drawing Handlers for Signature
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Handle File Uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (activeTool === 'merge') {
      setUploadedFiles(prev => [...prev, ...files]);
    } else {
      setUploadedFiles([files[0]]); // Single file for other tools
    }
    setResultBlob(null);
  };

  // Remove file from list (for Merge tool)
  const removeFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Run PDF Processing
  const processPdf = async () => {
    if (uploadedFiles.length === 0) return;
    setProcessing(true);
    setProgress(20);
    setResultBlob(null);

    try {
      const primaryFile = uploadedFiles[0];
      const baseName = primaryFile.name.replace(/\.[^/.]+$/, '');
      let outputBytes: Uint8Array;

      switch (activeTool) {
        case 'merge':
          setResultFileName(`Merged_Document_${Date.now()}`);
          outputBytes = await pdfUtils.mergePdfs(uploadedFiles);
          break;

        case 'split':
          setResultFileName(`${baseName}_splitted`);
          const blobs = await pdfUtils.splitPdf(primaryFile, splitRange);
          // Combine or download first for single blob, or zip them (we will return the first split page as demonstration)
          if (blobs.length > 0) {
            setResultBlob(blobs[0]);
            setProgress(100);
            setProcessing(false);
            return;
          }
          throw new Error('No pages split.');

        case 'rotate':
          setResultFileName(`${baseName}_rotated`);
          outputBytes = await pdfUtils.rotatePdf(primaryFile, rotationAngle);
          break;

        case 'watermark':
          setResultFileName(`${baseName}_watermarked`);
          outputBytes = await pdfUtils.watermarkPdf(primaryFile, watermarkText);
          break;

        case 'encrypt':
          if (!encryptPassword) throw new Error('Password is required.');
          setResultFileName(`${baseName}_protected`);
          outputBytes = await pdfUtils.encryptPdf(primaryFile, encryptPassword);
          break;

        case 'compress':
          setResultFileName(`${baseName}_compressed`);
          outputBytes = await pdfUtils.compressPdf(primaryFile, compressQuality);
          break;

        case 'sign':
          if (!hasSignature) throw new Error('Signature is required.');
          const canvas = sigCanvasRef.current;
          if (!canvas) throw new Error('Canvas not loaded.');
          
          setResultFileName(`${baseName}_signed`);
          const sigBase64 = canvas.toDataURL('image/png');
          
          outputBytes = await pdfUtils.signPdf(
            primaryFile,
            sigBase64,
            signPageNum - 1,
            signX,
            signY,
            signW,
            signH
          );
          break;

        default:
          throw new Error('Unsupported tool.');
      }

      setProgress(80);
      const blob = new Blob([outputBytes as any], { type: 'application/pdf' });
      setResultBlob(blob);
      setProgress(100);

    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error processing PDF');
    } finally {
      setProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resultFileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset signature canvas on tab switch
  useEffect(() => {
    setUploadedFiles([]);
    setResultBlob(null);
  }, [activeTool]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      
      {/* 1. Tool Selector (Sidebar style) */}
      <div className="lg:col-span-1 flex flex-col gap-2">
        <h3 className="text-sm font-bold text-outline px-3 mb-2 uppercase tracking-wider">PDF Tools</h3>
        
        {[
          { id: 'merge', label: 'Merge PDFs', icon: Merge },
          { id: 'split', label: 'Split PDF', icon: Scissors },
          { id: 'rotate', label: 'Rotate Pages', icon: RotateCw },
          { id: 'watermark', label: 'Watermark', icon: Type },
          { id: 'sign', label: 'Sign PDF', icon: PenTool },
          { id: 'encrypt', label: 'Encrypt PDF', icon: Lock },
          { id: 'compress', label: 'Compress PDF', icon: FileText },
        ].map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id as PdfToolType)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-semibold transition ${
                activeTool === tool.id
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface hover:bg-surface-variant/40'
              }`}
            >
              <Icon size={18} />
              <span>{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Workspace Panel */}
      <div className="lg:col-span-3 bg-surface-variant/15 border border-surface-variant/40 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
        
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-on-surface capitalize">
              {activeTool.replace('Pdf', '')} Tool
            </h2>
            <p className="text-sm text-outline mt-1">
              {activeTool === 'merge' && 'Select multiple PDF files to combine them into a single PDF.'}
              {activeTool === 'split' && 'Extract specific pages or ranges from a PDF.'}
              {activeTool === 'rotate' && 'Rotate all or specific pages in a PDF.'}
              {activeTool === 'watermark' && 'Add text overlay as a watermark across all pages.'}
              {activeTool === 'sign' && 'Draw a digital signature and place it anywhere in the PDF.'}
              {activeTool === 'encrypt' && 'Encrypt the PDF with a secure password.'}
              {activeTool === 'compress' && 'Compress images and pages to reduce PDF file size.'}
            </p>
          </div>

          {/* Upload Area */}
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-outline/30 rounded-2xl cursor-pointer hover:bg-surface-variant/20 transition p-4 text-center">
              <div className="flex flex-col items-center justify-center">
                <Upload size={32} className="text-outline/50 mb-2" />
                <p className="font-semibold text-on-surface-variant text-sm mb-1">
                  Click to upload PDF files
                </p>
                <p className="text-xs text-outline">
                  {activeTool === 'merge' ? 'Select one or more PDF files' : 'Select a single PDF file'}
                </p>
              </div>
              <input
                type="file"
                accept=".pdf"
                multiple={activeTool === 'merge'}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* List of uploaded files */}
            {uploadedFiles.length > 0 && (
              <div className="bg-surface border border-outline/20 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-semibold text-outline mb-2">Selected Files:</p>
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-surface-variant/20 p-2.5 rounded-xl border border-outline/10">
                    <div className="flex items-center gap-2 overflow-hidden mr-4">
                      <FileText size={16} className="text-primary flex-shrink-0" />
                      <span className="truncate text-on-surface font-medium">{file.name}</span>
                      <span className="text-xs text-outline">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    {activeTool === 'merge' && (
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-outline hover:text-error transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tool Options */}
          {uploadedFiles.length > 0 && (
            <div className="bg-surface border border-outline/20 rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-on-surface">Configuration</h4>

              {activeTool === 'split' && (
                <div>
                  <label className="block text-xs font-medium text-outline mb-1.5">Page Range (e.g., "1,2", "3-5", or "1-3,5")</label>
                  <input
                    type="text"
                    value={splitRange}
                    onChange={(e) => setSplitRange(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 rounded-xl bg-surface-variant/30 border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {activeTool === 'rotate' && (
                <div>
                  <label className="block text-xs font-medium text-outline mb-1.5">Rotation Angle</label>
                  <select
                    value={rotationAngle}
                    onChange={(e) => setRotationAngle(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-surface-variant/30 border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value={90}>90° Clockwise</option>
                    <option value={180}>180°</option>
                    <option value={270}>270° Clockwise</option>
                  </select>
                </div>
              )}

              {activeTool === 'watermark' && (
                <div>
                  <label className="block text-xs font-medium text-outline mb-1.5">Watermark Text</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 rounded-xl bg-surface-variant/30 border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {activeTool === 'encrypt' && (
                <div>
                  <label className="block text-xs font-medium text-outline mb-1.5">Set Password</label>
                  <input
                    type="password"
                    value={encryptPassword}
                    onChange={(e) => setEncryptPassword(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 rounded-xl bg-surface-variant/30 border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                    placeholder="Enter password..."
                  />
                </div>
              )}

              {activeTool === 'compress' && (
                <div>
                  <label className="block text-xs font-medium text-outline mb-1.5">Compression Tier</label>
                  <select
                    value={compressQuality}
                    onChange={(e) => setCompressQuality(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-surface-variant/30 border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value={0.3}>High Compression (Lower Quality)</option>
                    <option value={0.5}>Balanced (Recommended)</option>
                    <option value={0.8}>Low Compression (High Quality)</option>
                  </select>
                </div>
              )}

              {activeTool === 'sign' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-outline mb-1.5">Draw Signature</label>
                      <div className="border border-outline/30 rounded-2xl overflow-hidden bg-white">
                        <canvas
                          ref={sigCanvasRef}
                          width={350}
                          height={120}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-[120px] cursor-crosshair touch-none bg-white"
                        />
                        <div className="bg-surface-variant/20 px-3 py-1.5 flex justify-end border-t border-outline/10">
                          <button
                            type="button"
                            onClick={clearSignature}
                            className="text-xs font-medium text-error hover:text-error/80 transition"
                          >
                            Clear Canvas
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-outline">Signature Position</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-outline">Page Number</label>
                          <input
                            type="number"
                            min={1}
                            value={signPageNum}
                            onChange={(e) => setSignPageNum(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline/20 text-xs text-on-surface focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-outline">X coordinate</label>
                          <input
                            type="number"
                            value={signX}
                            onChange={(e) => setSignX(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline/20 text-xs text-on-surface focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-outline">Y coordinate</label>
                          <input
                            type="number"
                            value={signY}
                            onChange={(e) => setSignY(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline/20 text-xs text-on-surface focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-outline">Width (pt)</label>
                          <input
                            type="number"
                            value={signW}
                            onChange={(e) => setSignW(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline/20 text-xs text-on-surface focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action button & progress */}
        <div className="mt-8 pt-6 border-t border-outline/15">
          {processing && (
            <div className="mb-4">
              <div className="flex justify-between items-center text-xs text-outline mb-1.5">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-outline/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {resultBlob && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-primary" size={24} />
                <div>
                  <p className="text-sm font-semibold text-on-surface">Process Completed</p>
                  <p className="text-xs text-outline truncate max-w-md">{resultFileName}.pdf</p>
                </div>
              </div>
              <button
                onClick={downloadResult}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-sm font-semibold transition shadow-sm"
              >
                <Download size={14} />
                Download
              </button>
            </div>
          )}

          <button
            onClick={processPdf}
            disabled={uploadedFiles.length === 0 || processing}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary text-on-primary hover:bg-primary/95 disabled:opacity-50 rounded-full transition font-semibold shadow-sm"
          >
            <RefreshCw size={16} className={processing ? 'animate-spin' : ''} />
            Run {activeTool.toUpperCase()} Operation
          </button>
        </div>

      </div>

    </div>
  );
};
