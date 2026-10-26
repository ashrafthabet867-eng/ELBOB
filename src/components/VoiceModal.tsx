import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Volume2, Sparkles, PhoneOff, AlertCircle, Send, ArrowRight, Zap, Square, Loader2 } from 'lucide-react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewMessagePair: (userText: string, modelText: string) => void;
}

type VoiceState = 'listening' | 'processing' | 'speaking' | 'idle';

const QUICK_VOICE_QUESTIONS = [
  'ما هي معادلة المحاسبة الأساسية وماذا تمثل؟',
  'اشرح مبدأ الحيطة والحذر ولماذا يعد مهماً؟',
  'ما الفرق بين مجمل الربح وصافي الربح في قائمة الدخل؟',
];

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onNewMessagePair,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [userTranscript, setUserTranscript] = useState('');
  const [modelResponse, setModelResponse] = useState('');
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [callDuration, setCallDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const callTimerRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const isClosingRef = useRef(false);
  const liveTranscriptRef = useRef('');

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      setUserTranscript('');
      setErrorMessage('');
      setModelResponse('أهلاً بك! أنا «البوب». اضغط على الدائرة الخضراء وتحدث بسؤالك، وسأجيبك بصوت جيميني فوراً.');
      setCallDuration(0);

      callTimerRef.current = setInterval(() => {
        setCallDuration((s) => s + 1);
      }, 1000);

      const startTimer = setTimeout(() => {
        startListening();
      }, 200);

      return () => {
        clearTimeout(startTimer);
      };
    } else {
      isClosingRef.current = true;
      stopAll();
    }
    return () => {
      stopAll();
    };
  }, [isOpen]);

  const stopAll = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
      mediaRecorderRef.current = null;
    }

    setVoiceState('idle');
    setVolumeLevel(0);
  };

  // Start listening with high stability
  const startListening = async () => {
    if (isClosingRef.current) return;
    setErrorMessage('');
    setUserTranscript('');
    liveTranscriptRef.current = '';

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('المتصفح لا يدعم الوصول للمايك.');
        setVoiceState('idle');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 1. Audio Analyser for live visualizer
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          audioContextRef.current = audioCtx;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (isClosingRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const currentVol = Math.min(100, Math.round((avg / 128) * 100));
            setVolumeLevel(currentVol);

            // Silence Detection: 2.2s of silence after speaking auto-submits
            if (liveTranscriptRef.current.trim().length > 3) {
              if (currentVol < 10) {
                if (!silenceTimerRef.current) {
                  silenceTimerRef.current = setTimeout(() => {
                    stopListeningAndSubmit();
                  }, 2200);
                }
              } else {
                if (silenceTimerRef.current) {
                  clearTimeout(silenceTimerRef.current);
                  silenceTimerRef.current = null;
                }
              }
            }

            animFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (e) {
        console.warn('Audio analyser error:', e);
      }

      // 2. SpeechRecognition in continuous mode
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'ar-EG';
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onresult = (event: any) => {
            let fullText = '';
            for (let i = 0; i < event.results.length; ++i) {
              fullText += event.results[i][0].transcript;
            }
            if (fullText) {
              liveTranscriptRef.current = fullText;
              setUserTranscript(fullText);
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('SpeechRecognition error:', e);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition start failed:', e);
        }
      }

      // 3. MediaRecorder capture
      audioChunksRef.current = [];
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
        }
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setVolumeLevel(0);

        if (isClosingRef.current) return;

        const recognized = liveTranscriptRef.current.trim();
        if (recognized.length > 1) {
          executeVoiceTurn({ text: recognized });
          return;
        }

        const finalBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        if (finalBlob.size > 0) {
          const reader = new FileReader();
          reader.readAsDataURL(finalBlob);
          reader.onloadend = () => {
            const base64Data = (reader.result as string).split(',')[1];
            executeVoiceTurn({
              audioBase64: base64Data,
              mimeType: finalBlob.type || 'audio/webm',
            });
          };
        } else {
          setVoiceState('listening');
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setVoiceState('listening');
    } catch (err: any) {
      console.error('Mic error:', err);
      setVoiceState('idle');
      setErrorMessage(
        'يرجى السماح بالوصول للمايك في المتصفح لبدء المحادثة.'
      );
    }
  };

  const stopListeningAndSubmit = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  // Execute Voice Turn with Real Audio Output (Single-step lightning speed)
  const executeVoiceTurn = async (payload: {
    text?: string;
    audioBase64?: string;
    mimeType?: string;
  }) => {
    setVoiceState('processing');

    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, generateAudio: true }),
      });

      if (!res.ok) {
        throw new Error('فشل معالجة الصوت في الخادم');
      }

      const data = await res.json();
      const userText = data.userText || payload.text || 'سؤال صوتي';
      const modelText = data.modelText || 'عذراً، لم أتمكن من الحصول على الإجابة.';

      setUserTranscript(userText);
      setModelResponse(modelText);
      onNewMessagePair(userText, modelText);

      // Play audio directly if returned in the same call (lightning fast)
      if (data.audioBase64) {
        await playGeminiWavAudio(data.audioBase64, data.mimeType || 'audio/wav');
      } else {
        await playRealGeminiAudio(modelText);
      }
    } catch (err: any) {
      console.error('Voice turn error:', err);
      setVoiceState('idle');
      setErrorMessage('حدث خطأ في الاتصال. اضغط للتحدث مرة أخرى.');
    }
  };

  // Play decoded Gemini WAV/MP3 audio directly with waveform animation
  const playGeminiWavAudio = async (base64Audio: string, mimeType: string = 'audio/wav') => {
    setVoiceState('speaking');

    try {
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
        } catch (e) {}
      }

      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      (window as any).__activeElbobAudio = audio;

      const volInterval = setInterval(() => {
        setVolumeLevel(Math.round(25 + Math.random() * 55));
      }, 100);

      audio.onended = () => {
        clearInterval(volInterval);
        setVolumeLevel(0);
        setVoiceState('idle');
        currentAudioRef.current = null;
        (window as any).__activeElbobAudio = null;
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        clearInterval(volInterval);
        setVolumeLevel(0);
        setVoiceState('idle');
        currentAudioRef.current = null;
        (window as any).__activeElbobAudio = null;
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.warn('Audio playback failed:', err);
      setVoiceState('idle');
    }
  };

  // Fallback if needed
  const playRealGeminiAudio = async (text: string) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error('فشل توليد الصوت');

      const data = await res.json();
      if (data.audioBase64) {
        await playGeminiWavAudio(data.audioBase64, data.mimeType || 'audio/wav');
        return;
      }
    } catch (err) {
      console.warn('Real Gemini TTS fetch error, fallback to speech synthesis:', err);
    }

    // Fallback to browser synthesis if network unavailable
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[#*`_~|]/g, '').slice(0, 300);
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'ar-SA';
      utterance.onend = () => setVoiceState('idle');
      utterance.onerror = () => setVoiceState('idle');
      window.speechSynthesis.speak(utterance);
    } else {
      setVoiceState('idle');
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/95 backdrop-blur-2xl animate-fade-in font-sans">
      <div className="relative w-full max-w-lg h-[92vh] max-h-[760px] bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                  محادثة صوتية ذكية مع «البوب»
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  صوت جيميني
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                مباشر • {formatTime(callDuration)}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="إنهاء المكالمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Orb: Glowing Dynamic Pulse */}
        <div className="my-auto flex flex-col items-center justify-center space-y-5">
          <div className="relative flex items-center justify-center">
            {/* Glowing outer aura */}
            <div
              className={`absolute w-52 h-52 rounded-full transition-all duration-500 blur-xl ${
                voiceState === 'listening'
                  ? 'bg-rose-500/30 scale-125 animate-pulse'
                  : voiceState === 'speaking'
                  ? 'bg-emerald-500/35 scale-130 animate-pulse'
                  : voiceState === 'processing'
                  ? 'bg-sky-500/35 scale-110 animate-spin'
                  : 'bg-emerald-500/15 scale-100'
              }`}
            />

            {/* Main Interactive Button: Click anytime to toggle */}
            <button
              onClick={() => {
                if (voiceState === 'speaking') {
                  if (currentAudioRef.current) {
                    currentAudioRef.current.pause();
                    currentAudioRef.current = null;
                  }
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  setVoiceState('idle');
                } else if (voiceState === 'listening') {
                  stopListeningAndSubmit();
                } else if (voiceState === 'idle') {
                  startListening();
                }
              }}
              className={`relative w-36 sm:w-44 h-36 sm:h-44 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 border-2 cursor-pointer ${
                voiceState === 'listening'
                  ? 'bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 border-rose-300 shadow-rose-900/60 scale-105'
                  : voiceState === 'speaking'
                  ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-sky-400 border-emerald-200 shadow-emerald-900/60 scale-105'
                  : voiceState === 'processing'
                  ? 'bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 border-sky-300 shadow-sky-900/60'
                  : 'bg-gradient-to-tr from-emerald-700 via-teal-800 to-slate-900 border-emerald-400 shadow-lg'
              }`}
            >
              {voiceState === 'listening' ? (
                <Mic className="w-14 sm:w-16 h-14 sm:h-16 text-white animate-bounce" />
              ) : voiceState === 'speaking' ? (
                <Volume2 className="w-14 sm:w-16 h-14 sm:h-16 text-white animate-pulse" />
              ) : voiceState === 'processing' ? (
                <Sparkles className="w-12 sm:w-14 h-12 sm:h-14 text-white animate-spin" />
              ) : (
                <Mic className="w-14 sm:w-16 h-14 sm:h-16 text-white" />
              )}
            </button>
          </div>

          {/* Live Waveform Indicator */}
          {voiceState === 'listening' && (
            <div className="flex items-center gap-1.5 h-6">
              {[0.5, 1.2, 0.8, 1.6, 1.0, 1.4, 0.7].map((factor, i) => {
                const height = Math.max(4, Math.min(24, Math.round((volumeLevel * factor) / 3.5)));
                return (
                  <div
                    key={i}
                    className="w-1.5 bg-rose-400 rounded-full transition-all duration-75"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
              <span className="text-[11px] text-rose-300 mr-2 font-mono">
                {volumeLevel > 5 ? 'المايك يلتقط صوتك بنجاح' : 'تحدث بسؤالك...'}
              </span>
            </div>
          )}

          {/* Status Label */}
          <div className="text-center space-y-1">
            <span className="text-base font-bold tracking-wider text-slate-100 block">
              {voiceState === 'listening' && 'البوب يستمع إليك.. تفضل بالتحدث براحتك'}
              {voiceState === 'processing' && 'جاري تحضير الإجابة وتوليد صوت جيميني... ⚡'}
              {voiceState === 'speaking' && '«البوب» يتحدث بصوت جيميني الحقيقي...'}
              {voiceState === 'idle' && 'اضغط على الدائرة الخضراء وتحدث مباشرة'}
            </span>
            <p className="text-xs text-slate-400">
              {voiceState === 'listening'
                ? 'تحدث، وعندما تنتهي اضغط «أجب الآن يا بوب» أو توقف ثانيتين'
                : voiceState === 'speaking'
                ? 'انقر على الدائرة لمقاطعة الصوت وطرح سؤال جديد'
                : 'محادثة صوتية سريعة ومستقرة بدون أي انقطاع'}
            </p>
          </div>

          {/* Quick Voice Prompt Chips */}
          {voiceState === 'listening' && (
            <div className="w-full space-y-1.5 pt-1">
              <span className="text-[11px] text-emerald-400 font-semibold block text-right">
                💡 أو اضغط لطرح أحد الأسئلة وتجربة الصوت فوراً:
              </span>
              <div className="flex flex-col gap-1.5">
                {QUICK_VOICE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setUserTranscript(q);
                      executeVoiceTurn({ text: q });
                    }}
                    className="text-right text-xs bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-200 p-2 rounded-xl transition flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate">{q}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-400 group-hover:-translate-x-1 transition shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/60 border border-rose-500/30 px-3 py-1.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Live Subtitles & Transcripts */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 max-h-36 overflow-y-auto space-y-2 text-xs leading-relaxed">
          {userTranscript && (
            <div className="text-slate-300">
              <span className="font-bold text-sky-400">أنت: </span>
              <span>{userTranscript}</span>
            </div>
          )}
          {modelResponse && (
            <div className="text-emerald-200 pt-1 border-t border-slate-800/80">
              <span className="font-bold text-emerald-400">البوب (جيميني): </span>
              <span>{modelResponse}</span>
            </div>
          )}
        </div>

        {/* Bottom Actions: Send / Interrupt / End Call */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            {voiceState === 'listening' ? '🟢 جاهز للاستماع' : voiceState === 'speaking' ? '🔊 يتحدث الآن' : '⚡ رد فوري'}
          </div>

          <div className="flex items-center gap-3">
            {voiceState === 'listening' ? (
              <button
                onClick={stopListeningAndSubmit}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-full shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 rotate-180" />
                <span>أجب الآن يا بوب ⚡</span>
              </button>
            ) : voiceState === 'speaking' ? (
              <button
                onClick={() => {
                  if (currentAudioRef.current) {
                    currentAudioRef.current.pause();
                    currentAudioRef.current = null;
                  }
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  startListening();
                }}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs rounded-full shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>مقاطعة وسؤال جديد</span>
              </button>
            ) : (
              <button
                onClick={startListening}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-full shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>تحدث</span>
              </button>
            )}

            {/* End Call Button */}
            <button
              onClick={onClose}
              className="p-2.5 bg-rose-700 hover:bg-rose-600 text-white rounded-full transition cursor-pointer shadow-lg active:scale-95 flex items-center justify-center"
              title="إنهاء المكالمة"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
