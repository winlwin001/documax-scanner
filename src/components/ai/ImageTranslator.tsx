import React, { useState } from 'react';
import { useAiTranslation } from '../../hooks/useAiTranslation';
import { FileImage, Download, RefreshCw, CheckCircle2 } from 'lucide-react';

export const ImageTranslator: React.FC = () => {
  const { translateImage, loading, progress, isGeminiConfigured } = useAiTranslation();
  
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [translatedImage, setTranslatedImage] = useState<string>(''); // base64

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedImage(file);
    setTranslatedImage('');
    setImagePreview(URL.createObjectURL(file));
  };

  const handleTranslate = async () => {
    if (!uploadedImage) return;

    try {
      const result = await translateImage(uploadedImage, targetLang);
      setTranslatedImage(result.erasedImage);
    } catch (e: any) {
      alert(e.message || 'Image translation failed.');
    }
  };

  const downloadResult = () => {
    if (!translatedImage) return;
    const link = document.createElement('a');
    link.href = translatedImage;
    link.download = `translated-${uploadedImage?.name || 'image.jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Workspace */}
        <div className="flex-1 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-on-surface">AI Image Translation</h3>
            <p className="text-xs text-outline mt-1">Translate signs, posters, menus, or screenshots while maintaining their style.</p>
          </div>

          <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-outline/30 rounded-3xl cursor-pointer hover:bg-surface-variant/20 transition p-4 text-center">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-contain rounded-2xl" />
            ) : (
              <div className="flex flex-col items-center justify-center">
                <FileImage size={48} className="text-outline/40 mb-3" />
                <p className="font-semibold text-on-surface-variant text-sm mb-1">
                  Drag and drop your image, or click to browse
                </p>
                <p className="text-xs text-outline">Supports JPG, PNG, WEBP</p>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>

        {/* Right Configuration & Result */}
        <div className="w-full lg:w-80 flex flex-col justify-between bg-surface-variant/20 border border-outline/10 rounded-2xl p-6">
          <div className="space-y-6">
            <div>
              <h4 className="font-bold text-on-surface">Configuration</h4>
              <p className="text-xs text-outline mt-0.5">Choose translation parameters.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-outline mb-1.5">Target Language</label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="English">English</option>
                <option value="Burmese">Burmese (Myanmar)</option>
                <option value="Thai">Thai</option>
                <option value="Chinese">Chinese</option>
                <option value="Japanese">Japanese</option>
                <option value="Korean">Korean</option>
                <option value="Arabic">Arabic</option>
                <option value="French">French</option>
                <option value="Spanish">Spanish</option>
                <option value="German">German</option>
                <option value="Russian">Russian</option>
                <option value="Vietnamese">Vietnamese</option>
              </select>
            </div>

            {!isGeminiConfigured() && (
              <div className="bg-error/10 border border-error/25 p-3 rounded-xl text-xs text-error font-medium">
                Gemini API Key is not configured. Add it in settings to enable.
              </div>
            )}

            <button
              onClick={handleTranslate}
              disabled={!uploadedImage || loading || !isGeminiConfigured()}
              className="w-full py-3 bg-primary text-on-primary hover:bg-primary/95 disabled:opacity-50 rounded-xl font-semibold transition text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Translating...
                </>
              ) : (
                'Erase & Translate Image'
              )}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-outline/10 space-y-4">
            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-outline">
                  <span>Processing image...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-outline/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            {translatedImage && (
              <div className="bg-surface border border-primary/20 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-primary flex-shrink-0" size={24} />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Image Translated</p>
                    <p className="text-xs text-outline">Original text erased and replaced.</p>
                  </div>
                </div>
                
                <div className="border border-outline/10 rounded-lg overflow-hidden max-h-32 bg-black">
                  <img src={translatedImage} alt="Result preview" className="w-full h-full object-contain" />
                </div>

                <button
                  onClick={downloadResult}
                  className="flex items-center justify-center gap-1.5 w-full py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-lg text-xs font-semibold transition"
                >
                  <Download size={14} />
                  Download Image
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
