import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, ArrowRightLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { useAiTranslation } from '../../hooks/useAiTranslation';

export const VoiceTranslator: React.FC = () => {
  const { translateText, isGeminiConfigured } = useAiTranslation();
  
  const [langA, setLangA] = useState('English');
  const [langB, setLangB] = useState('Vietnamese');
  const [speechLangA, setSpeechLangA] = useState('en-US');
  const [speechLangB, setSpeechLangB] = useState('vi-VN');

  const [recordingSide, setRecordingSide] = useState<'A' | 'B' | null>(null);
  const [transcriptA, setTranscriptA] = useState('');
  const [transcriptB, setTranscriptB] = useState('');
  const [translationA, setTranslationA] = useState('');
  const [translationB, setTranslationB] = useState('');

  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      
      rec.onresult = async (event: any) => {
        const text = event.results[0][0].transcript;
        if (recordingSide === 'A') {
          setTranscriptA(text);
          await handleTranslation(text, 'A');
        } else if (recordingSide === 'B') {
          setTranscriptB(text);
          await handleTranslation(text, 'B');
        }
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setRecordingSide(null);
      };

      rec.onend = () => {
        setRecordingSide(null);
      };

      recognitionRef.current = rec;
    }
  }, [recordingSide, langA, langB]);

  const startListening = (side: 'A' | 'B') => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Safari.');
      return;
    }

    if (recordingSide) {
      recognitionRef.current.stop();
      if (recordingSide === side) {
        setRecordingSide(null);
        return;
      }
    }

    setRecordingSide(side);
    recognitionRef.current.lang = side === 'A' ? speechLangA : speechLangB;
    recognitionRef.current.start();
  };

  const handleTranslation = async (text: string, sourceSide: 'A' | 'B') => {
    setLoading(true);
    try {
      if (sourceSide === 'A') {
        const translated = await translateText(text, {
          sourceLang: langA,
          targetLang: langB,
          domain: 'general',
        });
        setTranslationB(translated);
        speakText(translated, speechLangB);
      } else {
        const translated = await translateText(text, {
          sourceLang: langB,
          targetLang: langA,
          domain: 'general',
        });
        setTranslationA(translated);
        speakText(translated, speechLangA);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text: string, langCode: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Stop current speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    window.speechSynthesis.speak(utterance);
  };

  const swapLanguages = () => {
    setLangA(langB);
    setLangB(langA);
    setSpeechLangA(speechLangB);
    setSpeechLangB(speechLangA);
    
    // Swap contents
    setTranscriptA(transcriptB);
    setTranscriptB(transcriptA);
    setTranslationA(translationB);
    setTranslationB(translationA);
  };

  // Map language selection to SpeechSynthesis codes
  const handleLangAChange = (val: string) => {
    setLangA(val);
    const codes: Record<string, string> = {
      English: 'en-US', Burmese: 'my-MM', Thai: 'th-TH', Chinese: 'zh-CN',
      Japanese: 'ja-JP', Korean: 'ko-KR', Arabic: 'ar-SA', French: 'fr-FR',
      Spanish: 'es-ES', German: 'de-DE', Russian: 'ru-RU', Vietnamese: 'vi-VN'
    };
    setSpeechLangA(codes[val] || 'en-US');
  };

  const handleLangBChange = (val: string) => {
    setLangB(val);
    const codes: Record<string, string> = {
      English: 'en-US', Burmese: 'my-MM', Thai: 'th-TH', Chinese: 'zh-CN',
      Japanese: 'ja-JP', Korean: 'ko-KR', Arabic: 'ar-SA', French: 'fr-FR',
      Spanish: 'es-ES', German: 'de-DE', Russian: 'ru-RU', Vietnamese: 'vi-VN'
    };
    setSpeechLangB(codes[val] || 'vi-VN');
  };

  return (
    <div className="bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-outline/10">
        <div>
          <h3 className="text-lg font-bold text-on-surface">AI Voice Translator</h3>
          <p className="text-xs text-outline mt-0.5">Translate spoken conversations in real-time.</p>
        </div>

        {/* Language Selectors */}
        <div className="flex items-center gap-3 bg-surface-variant/20 border border-outline/10 rounded-2xl p-2">
          <select
            value={langA}
            onChange={(e) => handleLangAChange(e.target.value)}
            className="bg-transparent text-sm text-on-surface font-semibold focus:outline-none cursor-pointer"
          >
            <option value="English">English</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Vietnamese">Vietnamese</option>
            <option value="Chinese">Chinese</option>
            <option value="Japanese">Japanese</option>
            <option value="Korean">Korean</option>
            <option value="Thai">Thai</option>
          </select>
          
          <button onClick={swapLanguages} className="p-1 hover:bg-surface-variant/30 text-primary rounded-lg transition">
            <ArrowRightLeft size={14} />
          </button>

          <select
            value={langB}
            onChange={(e) => handleLangBChange(e.target.value)}
            className="bg-transparent text-sm text-on-surface font-semibold focus:outline-none cursor-pointer"
          >
            <option value="Vietnamese">Vietnamese</option>
            <option value="English">English</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Chinese">Chinese</option>
            <option value="Japanese">Japanese</option>
            <option value="Korean">Korean</option>
            <option value="Thai">Thai</option>
          </select>
        </div>
      </div>

      {!isGeminiConfigured() && (
        <div className="flex items-center gap-2 p-3.5 bg-error/10 border border-error/25 rounded-2xl text-error text-xs font-semibold">
          <AlertCircle size={16} />
          <span>Gemini API Key is not configured. Add it in settings to translate.</span>
        </div>
      )}

      {/* Split Screen Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[280px]">
        
        {/* Left Side (A) */}
        <div className={`flex flex-col justify-between border rounded-3xl p-6 transition ${
          recordingSide === 'A' ? 'border-primary bg-primary/5' : 'border-outline/15 bg-surface'
        }`}>
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-outline uppercase">{langA} speaker</span>
              {transcriptA && (
                <button 
                  onClick={() => speakText(transcriptA, speechLangA)}
                  className="p-1.5 hover:bg-surface-variant/35 text-outline hover:text-on-surface rounded-lg transition"
                >
                  <Volume2 size={14} />
                </button>
              )}
            </div>
            
            <p className="text-base font-medium text-on-surface min-h-[48px]">
              {transcriptA || <span className="text-outline text-sm italic">Tap mic to speak...</span>}
            </p>

            {translationA && (
              <div className="mt-4 pt-4 border-t border-outline/10 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase">Translated to {langA}:</p>
                <p className="text-sm font-semibold text-on-surface-variant">{translationA}</p>
              </div>
            )}
          </div>

          <div className="flex justify-center mt-6">
            <button
              onClick={() => startListening('A')}
              disabled={loading || !isGeminiConfigured()}
              className={`p-4 rounded-full transition shadow-md ${
                recordingSide === 'A'
                  ? 'bg-error text-on-error animate-pulse'
                  : 'bg-primary text-on-primary hover:bg-primary/95 disabled:opacity-50'
              }`}
            >
              {recordingSide === 'A' ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>
        </div>

        {/* Right Side (B) */}
        <div className={`flex flex-col justify-between border rounded-3xl p-6 transition ${
          recordingSide === 'B' ? 'border-primary bg-primary/5' : 'border-outline/15 bg-surface'
        }`}>
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-outline uppercase">{langB} speaker</span>
              {transcriptB && (
                <button 
                  onClick={() => speakText(transcriptB, speechLangB)}
                  className="p-1.5 hover:bg-surface-variant/35 text-outline hover:text-on-surface rounded-lg transition"
                >
                  <Volume2 size={14} />
                </button>
              )}
            </div>

            <p className="text-base font-medium text-on-surface min-h-[48px]">
              {transcriptB || <span className="text-outline text-sm italic">Tap mic to speak...</span>}
            </p>

            {translationB && (
              <div className="mt-4 pt-4 border-t border-outline/10 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase">Translated to {langB}:</p>
                <p className="text-sm font-semibold text-on-surface-variant">{translationB}</p>
              </div>
            )}
          </div>

          <div className="flex justify-center mt-6">
            <button
              onClick={() => startListening('B')}
              disabled={loading || !isGeminiConfigured()}
              className={`p-4 rounded-full transition shadow-md ${
                recordingSide === 'B'
                  ? 'bg-error text-on-error animate-pulse'
                  : 'bg-primary text-on-primary hover:bg-primary/95 disabled:opacity-50'
              }`}
            >
              {recordingSide === 'B' ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>
        </div>

      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-xs text-outline font-medium">
          <RefreshCw size={14} className="animate-spin text-primary" />
          <span>Translating voice input...</span>
        </div>
      )}

    </div>
  );
};
