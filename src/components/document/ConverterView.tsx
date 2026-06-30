import React, { useState } from 'react';
import { FileText, FileImage, Download, RefreshCw, FileCode, CheckCircle2 } from 'lucide-react';
import { converterUtils } from '../../utils/converterUtils';

type ConverterTab = 'text' | 'image';

export const ConverterView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConverterTab>('text');

  // Text Converter State
  const [textContent, setTextContent] = useState('');
  const [textType, setTextType] = useState<'txt' | 'md' | 'html' | 'json'>('txt');
  const [fileName, setFileName] = useState('converted-document');
  const [isConvertingText, setIsConvertingText] = useState(false);
  const [textConvertResult, setTextConvertResult] = useState<{ blob: Blob; type: 'pdf' | 'docx' } | null>(null);

  // Image Converter State
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [targetFormat, setTargetFormat] = useState<'jpeg' | 'png' | 'webp'>('webp');
  const [isConvertingImage, setIsConvertingImage] = useState(false);
  const [imageConvertResult, setImageConvertResult] = useState<Blob | null>(null);

  // Handle Text Upload
  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name.replace(/\.[^/.]+$/, ''));
    
    // Auto-detect type
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'md') setTextType('md');
    else if (ext === 'html' || ext === 'htm') setTextType('html');
    else if (ext === 'json') setTextType('json');
    else setTextType('txt');

    const reader = new FileReader();
    reader.onload = (evt) => {
      setTextContent(evt.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  // Convert Text
  const convertText = async (target: 'pdf' | 'docx') => {
    if (!textContent.trim()) return;
    setIsConvertingText(true);
    setTextConvertResult(null);

    try {
      let resultBlob: Blob;
      if (target === 'pdf') {
        resultBlob = await converterUtils.textToPdf(textContent, textType, fileName);
      } else {
        resultBlob = await converterUtils.textToDocx(textContent, textType);
      }
      
      setTextConvertResult({ blob: resultBlob, type: target });
    } catch (e) {
      console.error(e);
      alert('Failed to convert text.');
    } finally {
      setIsConvertingText(false);
    }
  };

  // Handle Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedImage(file);
    setImageConvertResult(null);
    setImagePreview(URL.createObjectURL(file));
  };

  // Convert Image
  const convertImage = async () => {
    if (!uploadedImage) return;
    setIsConvertingImage(true);
    setImageConvertResult(null);

    try {
      const resultBlob = await converterUtils.convertImage(uploadedImage, targetFormat);
      setImageConvertResult(resultBlob);
    } catch (e) {
      console.error(e);
      alert('Failed to convert image.');
    } finally {
      setIsConvertingImage(false);
    }
  };

  // Download converted files
  const downloadResult = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-surface-variant/10 rounded-3xl border border-surface-variant/40 overflow-hidden shadow-sm">
      
      {/* Tabs */}
      <div className="flex border-b border-outline/10 bg-surface-variant/20">
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition border-b-2 ${
            activeTab === 'text'
              ? 'border-primary text-primary bg-surface/40'
              : 'border-transparent text-outline hover:text-on-surface-variant'
          }`}
        >
          <FileText size={18} />
          Text Converter
        </button>
        <button
          onClick={() => setActiveTab('image')}
          className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition border-b-2 ${
            activeTab === 'image'
              ? 'border-primary text-primary bg-surface/40'
              : 'border-transparent text-outline hover:text-on-surface-variant'
          }`}
        >
          <FileImage size={18} />
          Image Converter
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'text' ? (
          /* 1. Text Converter */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Input Column */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-on-surface">Enter or Import Text</h3>
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/10 hover:bg-secondary/20 text-primary rounded-lg cursor-pointer text-xs font-medium transition">
                  <RefreshCw size={12} />
                  <span>Import File</span>
                  <input
                    type="file"
                    accept=".txt,.md,.html,.json"
                    onChange={handleTextFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-outline mb-1">Document Name</label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-outline mb-1">Format Type</label>
                  <select
                    value={textType}
                    onChange={(e) => setTextType(e.target.value as any)}
                    className="px-3 py-2 rounded-xl bg-surface border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="txt">Plain Text (.txt)</option>
                    <option value="md">Markdown (.md)</option>
                    <option value="html">HTML (.html)</option>
                    <option value="json">JSON (.json)</option>
                  </select>
                </div>
              </div>

              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 rounded-2xl bg-surface border border-outline/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-on-surface font-mono text-sm transition"
                placeholder={`Type or paste your text here...\nFor Markdown, we support headings (#, ##), bold (**bold**), and lists (- bullet).`}
              />
            </div>

            {/* Actions & Result Column */}
            <div className="lg:col-span-2 flex flex-col justify-between bg-surface-variant/30 rounded-2xl p-6 border border-outline/10">
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-on-surface mb-2">Convert Options</h4>
                  <p className="text-xs text-outline mb-4">Export your formatted text into high-quality PDF or Microsoft Word documents.</p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => convertText('pdf')}
                    disabled={!textContent.trim() || isConvertingText}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl font-medium transition shadow-sm"
                  >
                    <FileCode size={16} />
                    Convert to PDF
                  </button>
                  <button
                    onClick={() => convertText('docx')}
                    disabled={!textContent.trim() || isConvertingText}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-secondary text-on-secondary hover:bg-secondary/90 disabled:opacity-50 rounded-xl font-medium transition shadow-sm"
                  >
                    <FileText size={16} />
                    Convert to Word (.docx)
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-outline/10">
                {isConvertingText && (
                  <div className="flex items-center gap-3 text-sm text-outline">
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Converting your document...</span>
                  </div>
                )}

                {textConvertResult && (
                  <div className="bg-surface border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-primary" size={24} />
                      <div>
                        <p className="text-sm font-semibold text-on-surface">Ready to Download</p>
                        <p className="text-xs text-outline">
                          {fileName}.{textConvertResult.type}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadResult(textConvertResult.blob, textConvertResult.type)}
                      className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full transition"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* 2. Image Converter */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Input Column */}
            <div className="lg:col-span-3 space-y-4">
              <h3 className="text-lg font-bold text-on-surface">Upload Image</h3>
              
              <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-outline/30 rounded-3xl cursor-pointer hover:bg-surface-variant/20 transition p-6 text-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain rounded-2xl" />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <FileImage size={48} className="text-outline/50 mb-3" />
                    <p className="font-semibold text-on-surface-variant text-sm mb-1">
                      Drag and drop your image, or click to browse
                    </p>
                    <p className="text-xs text-outline">Supports JPG, PNG, WEBP, and HEIC</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Actions & Result Column */}
            <div className="lg:col-span-2 flex flex-col justify-between bg-surface-variant/30 rounded-2xl p-6 border border-outline/10">
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-on-surface mb-2">Convert Options</h4>
                  <p className="text-xs text-outline mb-4">Choose your target image format. Converts instantly inside your browser.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-outline mb-1.5">Target Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['webp', 'jpeg', 'png'] as const).map((format) => (
                      <button
                        key={format}
                        onClick={() => setTargetFormat(format)}
                        className={`py-2 rounded-xl text-sm font-medium border transition ${
                          targetFormat === format
                            ? 'bg-primary text-on-primary border-primary shadow-sm'
                            : 'bg-surface text-on-surface border-outline/30 hover:bg-surface-variant/30'
                        }`}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={convertImage}
                  disabled={!uploadedImage || isConvertingImage}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl font-medium transition shadow-sm"
                >
                  <RefreshCw size={16} className={isConvertingImage ? 'animate-spin' : ''} />
                  Convert Image
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-outline/10">
                {isConvertingImage && (
                  <div className="flex items-center gap-3 text-sm text-outline">
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Converting your image...</span>
                  </div>
                )}

                {imageConvertResult && (
                  <div className="bg-surface border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-primary" size={24} />
                      <div>
                        <p className="text-sm font-semibold text-on-surface">Image Converted</p>
                        <p className="text-xs text-outline">
                          Ready for download in {targetFormat.toUpperCase()} format.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadResult(imageConvertResult, targetFormat)}
                      className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full transition"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
