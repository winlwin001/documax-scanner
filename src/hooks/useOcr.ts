import { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useSubscription } from '../context/SubscriptionContext';

interface OcrOptions {
  language?: string;
  useGoogleVision?: boolean;
}

export const useOcr = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('');
  const { incrementUsage, checkLimit } = useSubscription();

  const performOcr = async (imageBlob: Blob, options: OcrOptions = {}) => {
    const { language = 'eng', useGoogleVision = false } = options;

    if (!checkLimit('ocrRuns')) {
      throw new Error('OCR monthly limit reached for your subscription tier. Please upgrade.');
    }

    setLoading(true);
    setProgress(0);
    setText('');

    try {
      // If user wants Google Vision, and we are online and Supabase is configured
      if (useGoogleVision && isSupabaseConfigured && navigator.onLine) {
        setProgress(0.3);
        // Convert Blob to Base64
        const base64 = await blobToBase64(imageBlob);
        const base64Content = base64.split(',')[1];

        setProgress(0.6);
        // Invoke Supabase Edge Function or direct Google Vision API if configured
        const { data, error } = await supabase.functions.invoke('google-vision-ocr', {
          body: { image: base64Content, language }
        });

        if (error) throw error;
        
        const extractedText = data?.text || 'No text detected.';
        setText(extractedText);
        setProgress(1);
        incrementUsage('ocrRuns');
        return extractedText;
      } else {
        // Fallback: Local Offline OCR using Tesseract.js
        setProgress(0.1);
        const worker = await createWorker('eng'); // Default to English
        
        // If other languages are selected, we can load them
        if (language !== 'eng' && language !== 'en') {
          // Tesseract uses 3-letter codes, map them if needed
          const langCode = mapLanguageCode(language);
          await worker.reinitialize(langCode);
        }

        setProgress(0.4);
        const { data: { text: extractedText } } = await worker.recognize(imageBlob);
        
        await worker.terminate();

        setText(extractedText);
        setProgress(1);
        incrementUsage('ocrRuns');
        return extractedText;
      }
    } catch (error: any) {
      console.error('OCR Error:', error);
      throw new Error(error.message || 'Failed to extract text from the document.');
    } finally {
      setLoading(false);
    }
  };

  return {
    performOcr,
    loading,
    progress,
    text,
  };
};

// Helper to convert Blob to Base64 string
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Map 2-letter lang to Tesseract 3-letter codes
const mapLanguageCode = (lang: string): string => {
  const mapping: Record<string, string> = {
    en: 'eng',
    es: 'spa',
    fr: 'fra',
    de: 'deu',
    vi: 'vie',
  };
  return mapping[lang] || 'eng';
};
