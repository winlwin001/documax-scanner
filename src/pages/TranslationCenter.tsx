import React, { useState } from 'react';
import { 
  FileText, FileImage, Headphones, Languages, ShieldCheck, 
  Download, RefreshCw, Copy 
} from 'lucide-react';
import { ImageTranslator } from '../components/ai/ImageTranslator';
import { VoiceTranslator } from '../components/ai/VoiceTranslator';
import { GlossaryManager } from '../components/ai/GlossaryManager';
import { useAiTranslation } from '../hooks/useAiTranslation';
import { useAudioTranslator } from '../hooks/useAudioTranslator';

type TranslationMode = 'text' | 'image' | 'audio' | 'voice' | 'glossary';

export const TranslationCenter: React.FC = () => {
  const [mode, setMode] = useState<TranslationMode>('text');
  const { translateText, loading: textLoading, progress: textProgress, isGeminiConfigured } = useAiTranslation();
  const { translateAudio, loading: audioLoading, progress: audioProgress } = useAudioTranslator();

  // Text Translation State
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [domain, setDomain] = useState('general');

  // Audio Translation State
  const [audioFile, setAudioFile] = useState<File | null>(0 as any); // Type fix
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioSubtitles, setAudioSubtitles] = useState('');
  const [audioTargetLang, setAudioTargetLang] = useState('English');
  const [burnSubtitles, setBurnSubtitles] = useState(false);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  // Revoke object URL on unmount/update to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (processedVideoUrl) {
        URL.revokeObjectURL(processedVideoUrl);
      }
    };
  }, [processedVideoUrl]);

  // Handle Text Translation
  const handleTextTranslate = async () => {
    if (!sourceText.trim()) return;
    setTranslatedText('');
    
    // Load glossary from localStorage
    let glossary = {};
    const savedGlossary = localStorage.getItem('translation_glossary');
    if (savedGlossary) {
      try {
        glossary = JSON.parse(savedGlossary);
      } catch (e) {}
    }

    try {
      const result = await translateText(sourceText, {
        sourceLang,
        targetLang,
        domain,
        glossary,
      });
      setTranslatedText(result);
    } catch (e: any) {
      alert(e.message || 'Translation failed.');
    }
  };

  const parseSRT = (srtText: string) => {
    const segments: { start: number; end: number; text: string }[] = [];
    const blocks = srtText.trim().split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/);
        if (timeMatch) {
          const start = parseInt(timeMatch[1], 10) * 3600 +
                        parseInt(timeMatch[2], 10) * 60 +
                        parseInt(timeMatch[3], 10) +
                        parseInt(timeMatch[4], 10) / 1000;
          const end = parseInt(timeMatch[5], 10) * 3600 +
                      parseInt(timeMatch[6], 10) * 60 +
                      parseInt(timeMatch[7], 10) +
                      parseInt(timeMatch[8], 10) / 1000;
          const text = lines.slice(2).join('\n').trim();
          segments.push({ start, end, text });
        }
      }
    }
    return segments;
  };

  const processVideoWithSubtitles = async (file: File, srtText: string) => {
    setIsProcessingVideo(true);
    setVideoProgress(0);

    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    await new Promise((resolve) => {
      video.onloadedmetadata = resolve;
    });

    const canvas = document.createElement('canvas');
    const maxDim = 720;
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 360;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    const segments = parseSRT(srtText);

    // Capture canvas at 30 FPS
    const canvasStream = canvas.captureStream(30);

    // Capture audio track
    let audioTrack: MediaStreamTrack | null = null;
    try {
      // @ts-ignore
      const fileStream = video.captureStream ? video.captureStream() : (video.mozCaptureStream ? video.mozCaptureStream() : null);
      if (fileStream) {
        audioTrack = fileStream.getAudioTracks()[0] || null;
      }
    } catch (e) {
      console.warn('Could not capture original audio track:', e);
    }

    const outputStream = new MediaStream();
    canvasStream.getVideoTracks().forEach(track => outputStream.addTrack(track));
    if (audioTrack) {
      outputStream.addTrack(audioTrack);
    }

    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(outputStream, options);
    } catch (e) {
      mediaRecorder = new MediaRecorder(outputStream);
    }

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recordPromise = new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
    });

    mediaRecorder.start();
    video.play();

    // Render fast by speeding up playback rate
    video.playbackRate = 2.0;

    const drawFrame = () => {
      if (video.paused || video.ended) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const currTime = video.currentTime;
      const activeSeg = segments.find(seg => currTime >= seg.start && currTime <= seg.end);

      if (activeSeg) {
        const fontSize = Math.max(14, Math.round(canvas.height * 0.055));
        ctx.font = `bold ${fontSize}px "Outfit", sans-serif`;
        
        const text = activeSeg.text;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        
        const paddingX = 14;
        const paddingY = 8;
        const bgW = textWidth + paddingX * 2;
        const bgH = fontSize + paddingY * 2;
        const bgX = (canvas.width - bgW) / 2;
        const bgY = canvas.height - bgH - Math.round(canvas.height * 0.08);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bgX, bgY, bgW, bgH, 8);
        } else {
          ctx.rect(bgX, bgY, bgW, bgH);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(text, canvas.width / 2, bgY + paddingY);
      }

      setVideoProgress(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
      requestAnimationFrame(drawFrame);
    };

    video.onplay = () => {
      drawFrame();
    };

    await new Promise<void>((resolve) => {
      video.onended = () => {
        mediaRecorder.stop();
        resolve();
      };
    });

    const recordedBlob = await recordPromise;
    setVideoProgress(100);
    setIsProcessingVideo(false);
    
    const url = URL.createObjectURL(recordedBlob);
    setProcessedVideoUrl(url);
  };

  // Handle Audio Translation
  const handleAudioTranslate = async () => {
    const file = audioFile as unknown as File;
    if (!file) return;

    setAudioTranscript('');
    setAudioSubtitles('');
    setProcessedVideoUrl(null);

    try {
      const result = await translateAudio(file, {
        targetLang: audioTargetLang,
        generateSubtitles: true,
      });
      setAudioTranscript(result.transcript);
      setAudioSubtitles(result.subtitles);

      const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4');
      if (isVideo) {
        if (burnSubtitles) {
          await processVideoWithSubtitles(file, result.subtitles);
        } else {
          setProcessedVideoUrl(URL.createObjectURL(file));
        }
      }
    } catch (e: any) {
      alert(e.message || 'Audio translation failed.');
    }
  };

  // Handle Audio File Selection
  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file as any);
    setAudioTranscript('');
    setAudioSubtitles('');
    setProcessedVideoUrl(null);
  };

  // Download subtitles or transcript
  const downloadTextFile = (content: string, fileName: string, ext: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const isVideoFile = audioFile && (
    (audioFile as unknown as File).type.startsWith('video/') || 
    (audioFile as unknown as File).name.endsWith('.mp4')
  );

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-on-surface">AI Translation Center</h1>
        <p className="text-sm text-outline mt-1">
          Translate texts, documents, images, audio, or live voice using advanced Gemini LLM context.
        </p>
      </div>

      {/* Modes Navigation Tabs */}
      <div className="flex border-b border-outline/10 overflow-x-auto pb-1 bg-surface-variant/20 rounded-t-3xl">
        {[
          { id: 'text', label: 'Text Translate', icon: Languages },
          { id: 'image', label: 'Image Translate', icon: FileImage },
          { id: 'audio', label: 'Audio & Video', icon: Headphones },
          { id: 'voice', label: 'Voice Mode', icon: FileText },
          { id: 'glossary', label: 'Glossary & Cache', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id as TranslationMode)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition border-b-2 flex-shrink-0 ${
                mode === tab.id
                  ? 'border-primary text-primary bg-surface/40'
                  : 'border-transparent text-outline hover:text-on-surface-variant'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Mode Workspaces */}
      
      {/* 1. TEXT TRANSLATION */}
      {mode === 'text' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Source Panel */}
          <div className="lg:col-span-3 bg-surface border border-outline/15 rounded-3xl p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-outline uppercase">Source Text</span>
                <div className="flex gap-2">
                  <select
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    className="px-3 py-1 bg-surface-variant/30 border border-outline/20 rounded-lg text-xs font-semibold text-on-surface focus:outline-none"
                  >
                    <option value="auto">Detect Language (Auto)</option>
                    <option value="English">English</option>
                    <option value="Vietnamese">Vietnamese</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                  </select>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="px-3 py-1 bg-surface-variant/30 border border-outline/20 rounded-lg text-xs font-semibold text-on-surface focus:outline-none"
                    title="Domain Terminology"
                  >
                    <option value="general">General Context</option>
                    <option value="legal">Legal Context</option>
                    <option value="medical">Medical Context</option>
                    <option value="business">Business Context</option>
                    <option value="technical">Technical Context</option>
                  </select>
                </div>
              </div>
              
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={10}
                className="w-full px-4 py-3 rounded-2xl bg-surface-variant/10 border border-outline/30 focus:border-primary focus:outline-none text-sm text-on-surface"
                placeholder="Enter text to translate..."
              />
            </div>

            <div className="mt-6 pt-4 border-t border-outline/10 flex items-center justify-between">
              {!isGeminiConfigured() && (
                <span className="text-xs text-error font-medium">Gemini Key not configured</span>
              )}
              <button
                onClick={handleTextTranslate}
                disabled={!sourceText.trim() || textLoading || !isGeminiConfigured()}
                className="px-6 py-2.5 bg-primary text-on-primary hover:bg-primary/95 disabled:opacity-50 rounded-full font-semibold text-sm transition shadow-sm"
              >
                {textLoading ? 'Translating...' : 'Translate'}
              </button>
            </div>
          </div>

          {/* Target Panel */}
          <div className="lg:col-span-2 bg-surface-variant/15 border border-surface-variant/40 rounded-3xl p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-outline uppercase">Translation</span>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="px-3 py-1 bg-surface border border-outline/20 rounded-lg text-xs font-semibold text-on-surface focus:outline-none"
                >
                  <option value="Spanish">Spanish</option>
                  <option value="English">English</option>
                  <option value="Vietnamese">Vietnamese</option>
                  <option value="Burmese">Burmese (Myanmar)</option>
                  <option value="Thai">Thai</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Korean">Korean</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                </select>
              </div>

              <div className="w-full min-h-[220px] p-4 rounded-2xl bg-surface border border-outline/10 text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">
                {textLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-outline">
                    <RefreshCw className="animate-spin text-primary" size={24} />
                    <span>Translating via Gemini... {textProgress}%</span>
                  </div>
                ) : (
                  translatedText || <span className="text-outline italic text-sm">Translation will appear here...</span>
                )}
              </div>
            </div>

            {translatedText && (
              <div className="flex items-center gap-2 justify-end mt-6 pt-4 border-t border-outline/10">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(translatedText);
                    alert('Copied translation to clipboard!');
                  }}
                  className="p-2 hover:bg-surface rounded-xl text-outline hover:text-on-surface transition"
                  title="Copy to Clipboard"
                >
                  <Copy size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. IMAGE TRANSLATION */}
      {mode === 'image' && <ImageTranslator />}

      {/* 3. AUDIO & VIDEO TRANSLATION */}
      {mode === 'audio' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Audio Upload Panel */}
          <div className="lg:col-span-2 bg-surface border border-outline/15 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-on-surface">Audio/Video Subtitle Translator</h3>
                <p className="text-xs text-outline mt-0.5">Upload media files to generate translated transcripts and timed subtitles.</p>
              </div>

              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-outline/30 rounded-2xl cursor-pointer hover:bg-surface-variant/20 transition p-4 text-center">
                <div className="flex flex-col items-center justify-center">
                  <Headphones size={32} className="text-outline/40 mb-2" />
                  <p className="font-semibold text-on-surface-variant text-sm mb-0.5">
                    {audioFile ? (audioFile as unknown as File).name : 'Select Audio/Video'}
                  </p>
                  <p className="text-xs text-outline">Supports MP3, WAV, M4A, MP4</p>
                </div>
                <input type="file" accept="audio/*,video/*" onChange={handleAudioChange} className="hidden" />
              </label>

              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5">Target Language</label>
                <select
                  value={audioTargetLang}
                  onChange={(e) => setAudioTargetLang(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline/30 text-sm text-on-surface focus:outline-none"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Vietnamese">Vietnamese</option>
                  <option value="Thai">Thai</option>
                  <option value="Burmese">Burmese</option>
                </select>
              </div>

              {/* Burn Subtitles Switch (Rendered conditionally for video files only) */}
              {isVideoFile && (
                <div className="flex flex-col gap-1.5 p-3.5 bg-surface-variant/20 rounded-2xl border border-outline/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-on-surface">Burn Subtitles into Video</span>
                      <p className="text-[10px] text-outline mt-0.5">Hardcode the translated subtitles onto the video file</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={burnSubtitles}
                        onChange={(e) => setBurnSubtitles(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-outline/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleAudioTranslate}
              disabled={!audioFile || audioLoading || isProcessingVideo || !isGeminiConfigured()}
              className="w-full mt-8 py-3.5 bg-primary text-on-primary hover:bg-primary/95 disabled:opacity-50 rounded-full font-semibold transition text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              {audioLoading || isProcessingVideo ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  {isProcessingVideo ? `Burning Subtitles... ${videoProgress}%` : 'Transcribing & Translating...'}
                </>
              ) : isVideoFile ? (
                'Process Video & Subtitles'
              ) : (
                'Generate Transcript & Subtitles'
              )}
            </button>
          </div>

          {/* Transcript / Subtitle Output Panel */}
          <div className="lg:col-span-3 bg-surface-variant/15 border border-surface-variant/40 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-bold text-outline uppercase">Output Files</span>
              
              {audioLoading || isProcessingVideo ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-outline">
                  <RefreshCw className="animate-spin text-primary" size={28} />
                  <span>
                    {isProcessingVideo 
                      ? `Burning subtitles into video... ${videoProgress}%` 
                      : `Processing audio file... ${audioProgress}%`}
                  </span>
                  <p className="text-[10px] max-w-xs text-center text-outline/85">
                    {isProcessingVideo 
                      ? 'Rendering video frames and drawing subtitle overlays in fast-forward.' 
                      : 'Gemini is transcribing speech and aligning timestamps.'}
                  </p>
                </div>
              ) : audioTranscript ? (
                <div className="space-y-4">
                  
                  {/* Transcript box */}
                  <div className="bg-surface border border-outline/10 p-4 rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-bold text-primary uppercase">Transcript</p>
                      <button
                        onClick={() => downloadTextFile(audioTranscript, 'transcript', 'txt')}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <Download size={12} /> Download TXT
                      </button>
                    </div>
                    <div className="text-xs text-on-surface-variant max-h-36 overflow-y-auto whitespace-pre-wrap font-sans">
                      {audioTranscript}
                    </div>
                  </div>

                  {/* Subtitles box */}
                  {audioSubtitles && (
                    <div className="bg-surface border border-outline/10 p-4 rounded-2xl">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-bold text-primary uppercase">SRT Subtitles</p>
                        <button
                          onClick={() => downloadTextFile(audioSubtitles, 'subtitles', 'srt')}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          <Download size={12} /> Download SRT
                        </button>
                      </div>
                      <div className="text-[10px] text-on-surface-variant max-h-36 overflow-y-auto whitespace-pre-wrap font-mono bg-surface-variant/35 p-2 rounded-xl">
                        {audioSubtitles}
                      </div>
                    </div>
                  )}

                  {/* Processed Video box */}
                  {processedVideoUrl && (
                    <div className="bg-surface border border-outline/10 p-4 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-primary uppercase">Processed Video</p>
                        <a
                          href={processedVideoUrl}
                          download={burnSubtitles ? 'processed_video.webm' : (audioFile as unknown as File).name}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          <Download size={12} /> Download Video (MP4)
                        </a>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-outline/10 bg-black shadow-inner">
                        <video
                          src={processedVideoUrl}
                          controls
                          className="w-full max-h-64 object-contain"
                        />
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="py-20 text-center text-outline italic text-sm">
                  Upload an audio/video file and click translate.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. VOICE TRANSLATION */}
      {mode === 'voice' && <VoiceTranslator />}

      {/* 5. GLOSSARY & CACHE */}
      {mode === 'glossary' && <GlossaryManager />}

    </div>
  );
};
