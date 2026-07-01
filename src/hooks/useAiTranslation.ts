import { useState } from 'react';
import { useSubscription } from '../context/SubscriptionContext';

interface TranslationOptions {
  sourceLang?: string;
  targetLang: string;
  domain?: string; // 'general' | 'legal' | 'medical' | 'business' etc.
  glossary?: Record<string, string>;
}

export const useAiTranslation = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { incrementUsage, checkLimit } = useSubscription();

  const getFunctionUrl = (): string => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    return `${supabaseUrl}/functions/v1/gemini-proxy`;
  };

  const getAnonKey = (): string => {
    return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  };

  const isGeminiConfigured = (): boolean => {
    // The key is stored securely in the Supabase backend
    return !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  };

  // 1. Translate Plain Text
  const translateText = async (text: string, options: TranslationOptions): Promise<string> => {
    if (!checkLimit('ocrRuns')) {
      throw new Error('AI translation monthly limit reached. Please upgrade.');
    }

    setLoading(true);
    setProgress(20);

    const { sourceLang = 'auto', targetLang, domain = 'general', glossary = {} } = options;

    let glossaryInstruction = '';
    if (Object.keys(glossary).length > 0) {
      glossaryInstruction = `Strictly follow this glossary for terminology mapping:\n${JSON.stringify(glossary)}\n`;
    }

    const prompt = `
      You are an expert professional translator. 
      Translate the following text from ${sourceLang === 'auto' ? 'automatically detected language' : sourceLang} into ${targetLang}.
      
      Domain/Context: ${domain} (Use terminology and tone appropriate for this domain).
      ${glossaryInstruction}
      
      Preserve the original formatting (paragraphs, lists, indentations, line breaks, markdown, HTML tags) exactly as they are. Do not translate code blocks, HTML tags, or markdown formatting characters.
      
      Text to translate:
      """
      ${text}
      """
    `;

    try {
      setProgress(50);
      
      // Standard HTTP fetch call to bypass supabase-js client auth headers that cause Kong 404 errors
      const response = await fetch(getFunctionUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': getAnonKey(),
        },
        body: JSON.stringify({
          action: 'translate_text',
          payload: {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
            },
          },
        }),
      });

      setProgress(80);
      if (!response.ok) {
        let errMsg = 'Edge Function call failed.';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch {
          const errText = await response.text();
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      setProgress(100);
      incrementUsage('ocrRuns');
      return translatedText;
    } catch (error: any) {
      console.error('Gemini Translation Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 2. Multimodal Image Translation
  const translateImage = async (imageBlob: Blob, targetLang: string): Promise<{ translatedText: string; erasedImage: string }> => {
    setLoading(true);
    setProgress(20);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageBlob);
      });
      const base64DataUrl = await base64Promise;
      const base64Content = base64DataUrl.split(',')[1];

      setProgress(40);

      const prompt = `
        Analyze this image. Locate all text elements and return a JSON array containing their bounding boxes and their translation into "${targetLang}".
        
        The JSON output must be a list of objects, each having:
        - "text": The original text.
        - "translatedText": The translated text.
        - "box": [ymin, xmin, ymax, xmax] as integers representing percentages (0 to 100) of the image height and width.
        - "fontSize": estimated font size in pixels relative to a standard image size.
        - "color": The text color (hex code).
        - "bgColor": The background color behind the text (hex code, for erasing).

        Ensure the response is ONLY the raw JSON array, without markdown blocks.
      `;

      // Standard HTTP fetch call to bypass supabase-js client auth headers that cause Kong 404 errors
      const response = await fetch(getFunctionUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': getAnonKey(),
        },
        body: JSON.stringify({
          action: 'translate_image',
          payload: {
            mimeType: 'image/jpeg',
            data: base64Content,
            prompt,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            }
          },
        }),
      });

      setProgress(70);
      if (!response.ok) {
        let errMsg = 'Edge Function call failed.';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch {
          const errText = await response.text();
          errMsg = errText || errMsg;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const segments = JSON.parse(jsonText);

      setProgress(85);

      const img = new Image();
      img.src = base64DataUrl;
      await new Promise((resolve) => img.onload = resolve);

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create 2D canvas context.');

      ctx.drawImage(img, 0, 0);

      for (const seg of segments) {
        const [ymin, xmin, ymax, xmax] = seg.box;
        const x = (xmin / 100) * canvas.width;
        const y = (ymin / 100) * canvas.height;
        const w = ((xmax - xmin) / 100) * canvas.width;
        const h = ((ymax - ymin) / 100) * canvas.height;

        ctx.fillStyle = seg.bgColor || '#ffffff';
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

        ctx.fillStyle = seg.color || '#000000';
        const fontSize = Math.max(12, (h * 0.75));
        ctx.font = `bold ${fontSize}px "Outfit", sans-serif`;
        ctx.textBaseline = 'top';
        
        wrapText(ctx, seg.translatedText, x + 2, y + 2, w, fontSize * 1.2);
      }

      setProgress(100);
      incrementUsage('ocrRuns');

      return {
        translatedText: segments.map((s: any) => s.translatedText).join('\n'),
        erasedImage: canvas.toDataURL('image/jpeg', 0.9)
      };

    } catch (error) {
      console.error('Image Translation Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    translateText,
    translateImage,
    isGeminiConfigured,
    loading,
    progress,
  };
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
};
