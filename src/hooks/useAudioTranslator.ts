import { useState } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AudioTranslationOptions {
  targetLang: string;
  generateSubtitles?: boolean;
}

export const useAudioTranslator = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { incrementUsage, checkLimit } = useSubscription();

  const getLocalApiKey = (): string => {
    return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
  };

  const translateAudio = async (
    audioFile: File,
    options: AudioTranslationOptions
  ): Promise<{ transcript: string; subtitles: string }> => {
    if (!checkLimit('ocrRuns')) {
      throw new Error('AI operations monthly limit reached. Please upgrade.');
    }

    setLoading(true);
    setProgress(15);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(audioFile);
      });
      const base64DataUrl = await base64Promise;
      const base64Content = base64DataUrl.split(',')[1];
      
      setProgress(40);

      let mimeType = audioFile.type;
      if (!mimeType) {
        const ext = audioFile.name.split('.').pop()?.toLowerCase();
        if (ext === 'mp3') mimeType = 'audio/mp3';
        else if (ext === 'wav') mimeType = 'audio/wav';
        else if (ext === 'm4a') mimeType = 'audio/m4a';
        else if (ext === 'mp4') mimeType = 'video/mp4';
        else mimeType = 'audio/mp3';
      }

      const { targetLang, generateSubtitles = true } = options;
      
      let prompt = `
        You are an expert audio transcription and translation AI.
        Listen to this audio file carefully.
        
        1. Transcribe the audio verbatim.
        2. Translate the transcript into "${targetLang}".
      `;

      if (generateSubtitles) {
        prompt += `
          3. Generate standard SRT subtitle format with timestamps matching the audio.
             Use the exact format:
             1
             00:00:01,000 --> 00:00:04,500
             Translated subtitle line here.
             
          Your output must be a JSON object containing two keys:
          - "transcript": The full translated transcript as continuous paragraphs.
          - "subtitles": The SRT formatted subtitle text.
          
          Return ONLY the raw JSON object, without markdown block formatting.
        `;
      } else {
        prompt += `
          Your output must be a JSON object containing:
          - "transcript": The full translated transcript.
          - "subtitles": ""
          
          Return ONLY the raw JSON object.
        `;
      }

      setProgress(60);
      let result = { transcript: '', subtitles: '' };

      if (isSupabaseConfigured) {
        // Secure Server-side Call
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
          body: {
            action: 'translate_audio',
            payload: {
              mimeType,
              data: base64Content,
              prompt,
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
              }
            }
          }
        });

        if (error) throw error;
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        result = JSON.parse(jsonText);
      } else {
        // Local fallback
        const localKey = getLocalApiKey();
        if (!localKey) {
          throw new Error('Backend is not configured and no local Gemini Key was found.');
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${localKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { inlineData: { mimeType, data: base64Content } },
                    { text: prompt }
                  ]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
              }
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || 'Gemini Audio transcription failed.');
        }

        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        result = JSON.parse(jsonText);
      }

      setProgress(100);
      incrementUsage('ocrRuns');

      return {
        transcript: result.transcript || 'Transcription empty.',
        subtitles: result.subtitles || '',
      };

    } catch (error) {
      console.error('Audio Translation Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    translateAudio,
    loading,
    progress,
  };
};
