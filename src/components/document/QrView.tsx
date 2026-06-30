import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, ScanLine, Download, Camera, ShieldAlert } from 'lucide-react';
import { qrUtils } from '../../utils/qrUtils';
export const QrView: React.FC = () => {
  
  // Generator State
  const [qrText, setQrText] = useState('https://documax.app');
  const [generatedQr, setGeneratedQr] = useState<string>('');
  const [darkColor, setDarkColor] = useState('#000000');
  const [lightColor, setLightColor] = useState('#ffffff');

  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string>('');
  const [scannerError, setScannerError] = useState<string>('');
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRegionId = 'qr-reader-video';

  // Generate QR Code on text or color changes
  useEffect(() => {
    const generate = async () => {
      if (!qrText.trim()) return;
      try {
        const qrDataUrl = await qrUtils.generateQrCode(qrText, darkColor, lightColor);
        setGeneratedQr(qrDataUrl);
      } catch (err) {
        console.error(err);
      }
    };
    generate();
  }, [qrText, darkColor, lightColor]);

  // Handle Scanner toggle
  const toggleScanner = async () => {
    if (isScanning) {
      await stopScanner();
    } else {
      await startScanner();
    }
  };

  const startScanner = async () => {
    setScanResult('');
    setScannerError('');
    setIsScanning(true);

    // Wait for the DOM element to render
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(videoRegionId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            setScanResult(decodedText);
            stopScanner();
          },
          () => {
            // Keep scanning, silent errors
          }
        );
      } catch (err: any) {
        console.error('Error starting QR scanner:', err);
        setScannerError(err.message || 'Failed to access camera.');
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
    }
    scannerRef.current = null;
    setIsScanning(false);
  };

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        stopScanner();
      }
    };
  }, []);

  const downloadQrCode = () => {
    if (!generatedQr) return;
    const link = document.createElement('a');
    link.href = generatedQr;
    link.download = `qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* 1. QR Code Generator */}
      <div className="bg-surface-variant/20 rounded-3xl p-6 border border-surface-variant/50 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <QrCode size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">QR Code Generator</h2>
              <p className="text-sm text-outline">Create custom, high-res QR codes</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                QR Content (URL, Text, or Contact Info)
              </label>
              <textarea
                value={qrText}
                onChange={(e) => setQrText(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-2xl bg-surface border border-outline/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-on-surface text-sm transition"
                placeholder="Enter text to generate QR code..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                  Foreground Color
                </label>
                <div className="flex items-center gap-2 border border-outline/30 rounded-2xl p-2 bg-surface">
                  <input
                    type="color"
                    value={darkColor}
                    onChange={(e) => setDarkColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={darkColor}
                    onChange={(e) => setDarkColor(e.target.value)}
                    className="w-full bg-transparent border-0 text-sm font-mono text-on-surface focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
                  Background Color
                </label>
                <div className="flex items-center gap-2 border border-outline/30 rounded-2xl p-2 bg-surface">
                  <input
                    type="color"
                    value={lightColor}
                    onChange={(e) => setLightColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={lightColor}
                    onChange={(e) => setLightColor(e.target.value)}
                    className="w-full bg-transparent border-0 text-sm font-mono text-on-surface focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 mt-8">
          {generatedQr ? (
            <div className="p-4 bg-white rounded-3xl border border-outline/20 shadow-sm">
              <img src={generatedQr} alt="Generated QR" className="w-48 h-48 object-contain" />
            </div>
          ) : (
            <div className="w-48 h-48 border-2 border-dashed border-outline/20 rounded-3xl flex items-center justify-center text-outline">
              Waiting for input
            </div>
          )}

          <button
            onClick={downloadQrCode}
            disabled={!generatedQr}
            className="flex items-center justify-center gap-2 w-full max-w-xs py-3 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 rounded-full transition font-medium shadow-sm"
          >
            <Download size={16} />
            Download PNG
          </button>
        </div>
      </div>

      {/* 2. QR Code Scanner */}
      <div className="bg-surface-variant/20 rounded-3xl p-6 border border-surface-variant/50 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <ScanLine size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">QR & Barcode Scanner</h2>
              <p className="text-sm text-outline">Scan codes in real-time using camera</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            {isScanning ? (
              <div className="relative w-full aspect-square max-w-sm rounded-3xl overflow-hidden border border-outline/30 bg-black">
                <div id={videoRegionId} className="w-full h-full object-cover"></div>
                {/* Scanner viewfinder overlay */}
                <div className="absolute inset-0 pointer-events-none border-4 border-primary/40 m-8 rounded-2xl animate-pulse">
                  <div className="absolute inset-0 border-2 border-primary border-t-0 border-b-0"></div>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square max-w-sm rounded-3xl border-2 border-dashed border-outline/20 bg-surface flex flex-col items-center justify-center text-outline p-6 text-center">
                <Camera size={48} className="mb-4 text-outline/50" />
                <p className="font-medium text-on-surface-variant mb-1">Camera is off</p>
                <p className="text-xs max-w-xs">Start the scanner to scan any QR code or barcode</p>
              </div>
            )}

            {scannerError && (
              <div className="flex items-center gap-2 mt-4 text-error text-sm font-medium">
                <ShieldAlert size={16} />
                <span>{scannerError}</span>
              </div>
            )}

            {scanResult && (
              <div className="mt-6 w-full max-w-sm bg-surface border border-outline/30 rounded-2xl p-4">
                <p className="text-xs font-semibold text-outline mb-1">Scan Result:</p>
                <div className="bg-surface-variant/30 p-3 rounded-xl border border-outline/10 text-sm font-mono break-all text-on-surface">
                  {scanResult}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(scanResult);
                    alert('Copied result to clipboard!');
                  }}
                  className="w-full mt-3 py-2 border border-outline/30 hover:bg-surface-variant/30 text-on-surface rounded-xl text-xs font-medium transition"
                >
                  Copy to Clipboard
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <button
            onClick={toggleScanner}
            className={`flex items-center justify-center gap-2 w-full max-w-xs py-3 rounded-full transition font-medium shadow-sm ${
              isScanning
                ? 'bg-error text-on-error hover:bg-error/90'
                : 'bg-primary text-on-primary hover:bg-primary/90'
            }`}
          >
            <Camera size={16} />
            {isScanning ? 'Stop Scanner' : 'Start Scanner'}
          </button>
        </div>
      </div>

    </div>
  );
};
