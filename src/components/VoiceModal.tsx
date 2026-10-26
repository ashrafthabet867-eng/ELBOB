import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Volume2, Sparkles, PhoneOff, AlertCircle, Send, ArrowRight, Radio } from 'lucide-react';

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

const GEMINI_VOICES = [
  { id: 'Puck', label: 'صوت جيميني المعتمد (Puck)' },
  { id: 'Charon', label: 'صوت عميق وواثق (Charon)' },
  { id: 'Kore', label: 'صوت هادئ وواضح (Kore)' },
];

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onNewMessagePair,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('listening');
  const [userTranscript, setUserTranscript] = useState('');
  const [modelResponse, setModelResponse] = useState('');
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState('Puck');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioElemRef = useRef<HTMLAudioElement | null>(null);
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
      setModelResponse('أهلاً بك يا بطل! أنا «البوب» بصوت جيميني المباشر.. تفضل بالتحدث مباشرة.');
      setCallDuration(0);

      // Start call timer
      callTimerRef.current = setInterval(() => {
        setCallDuration((s) => s + 1);
      }, 1000);

      // Start listening directly
      const startTimer = setTimeout(() => {
        startListening();
      }, 150);

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
    if (currentAudioElemRef.current) {
      currentAudioElemRef.current.pause();
      currentAudioElemRef.current = null;
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

  // Start listening directly
  const startListening = async () => {
    if (isClosingRef.current) return;
    setErrorMessage('');
    setUserTranscript('');
    liveTranscriptRef.current = '';

    if (currentAudioElemRef.current) {
      currentAudioElemRef.current.pause();
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

      // Set up real-time Web Audio Analyser
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

            // Auto-submit on silence:
            if (liveTranscriptRef.current.trim().length > 2) {
              if (currentVol < 12) {
                if (!silenceTimerRef.current) {
                  silenceTimerRef.current = setTimeout(() => {
                    stopListeningAndSubmit();
                  }, 1200);
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
        console.warn('AudioContext Analyser:', e);
      }

      // Browser SpeechRecognition for instant Arabic transcription
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'ar-EG';
          recognition.continuous = false;
          recognition.interimResults = true;

          recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              interim += event.results[i][0].transcript;
            }
            if (interim) {
              liveTranscriptRef.current = interim;
              setUserTranscript(interim);
            }
          };

          recognition.onspeechend = () => {
            setTimeout(() => {
              stopListeningAndSubmit();
            }, 300);
          };

          recognition.onend = () => {
            if (liveTranscriptRef.current.trim().length > 1) {
              stopListeningAndSubmit();
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition error:', e);
        }
      }

      // MediaRecorder for resilient fallback
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
          executeGeminiLiveTurn({ text: recognized });
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
            executeGeminiLiveTurn({
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
        'يرجى السماح بالوصول للميكروفون في المتصفح لبدء المحادثة المباشرة.'
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

  // Execute Gemini Live Voice Turn (Text + Real Gemini Audio WAV)
  const executeGeminiLiveTurn = async (payload: {
    text?: string;
    audioBase64?: string;
    mimeType?: string;
  }) => {
    setVoiceState('processing');

    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          voiceName: selectedVoice,
        }),
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

      // PLAY REAL GEMINI VOICE AUDIO!
      if (data.audioBase64) {
        playRealGeminiAudio(data.audioBase64);
      } else {
        // Fallback to browser voice synthesis
        playBrowserVoice(modelText);
      }
    } catch (err: any) {
      console.error('Gemini Voice error:', err);
      setVoiceState('idle');
      setErrorMessage('حدث خطأ في الاتصال بالصوت. جرب مرة أخرى.');
    }
  };

  // Play Real Studio-Quality Gemini Audio
  const playRealGeminiAudio = (base64Audio: string) => {
    setVoiceState('speaking');

    try {
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      currentAudioElemRef.current = audio;

      // Animate visualizer while audio plays
      let simVolume = 0;
      const volInterval = setInterval(() => {
        simVolume = Math.round(30 + Math.random() * 55);
        setVolumeLevel(simVolume);
      }, 100);

      audio.onended = () => {
        clearInterval(volInterval);
        setVolumeLevel(0);
        currentAudioElemRef.current = null;

        // AUTO-RESUME LISTENING HANDS-FREE!
        if (!isClosingRef.current) {
          setTimeout(() => {
            if (!isClosingRef.current) startListening();
          }, 400);
        }
      };

      audio.onerror = () => {
        clearInterval(volInterval);
        setVolumeLevel(0);
        currentAudioElemRef.current = null;
        if (!isClosingRef.current) startListening();
      };

      audio.play().catch((playErr) => {
        console.warn('Audio play autoplay policy blocked:', playErr);
        clearInterval(volInterval);
        if (modelResponse) playBrowserVoice(modelResponse);
      });
    } catch (err) {
      console.error('Audio playback error:', err);
      if (modelResponse) playBrowserVoice(modelResponse);
    }
  };

  // Browser speech fallback
  const playBrowserVoice = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setVoiceState('listening');
      startListening();
      return;
    }

    window.speechSynthesis.cancel();
    setVoiceState('speaking');

    const cleanSpoken = text.replace(/[#*`_~|]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanSpoken);
    utterance.lang = 'ar-SA';
    utterance.rate = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang.startsWith('ar'));
    if (arVoice) utterance.voice = arVoice;

    utterance.onend = () => {
      if (!isClosingRef.current) {
        setTimeout(() => {
          if (!isClosingRef.current) startListening();
        }, 400);
      }
    };

    utterance.onerror = () => {
      if (!isClosingRef.current) startListening();
    };

    window.speechSynthesis.speak(utterance);
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
        
        {/* Top Header: Gemini Live Call Status */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                  محادثة صوتية ذكية (Gemini Live Voice)
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/30">
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

        {/* Center Orb: Gemini Live Dynamic Multi-layer Liquid Orb */}
        <div className="my-auto flex flex-col items-center justify-center space-y-5">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsating multi-color gradient aura (Gemini style) */}
            <div
              className={`absolute w-52 h-52 rounded-full transition-all duration-500 blur-xl ${
                voiceState === 'listening'
                  ? 'bg-gradient-to-r from-rose-500/30 via-amber-500/30 to-purple-500/30 scale-125 animate-pulse'
                  : voiceState === 'speaking'
                  ? 'bg-gradient-to-r from-emerald-500/35 via-teal-400/35 to-sky-500/35 scale-130 animate-pulse'
                  : voiceState === 'processing'
                  ? 'bg-gradient-to-r from-sky-500/35 via-indigo-500/35 to-fuchsia-500/35 scale-110 animate-spin'
                  : 'bg-emerald-500/15 scale-100'
              }`}
            />

            {/* Glowing Orb */}
            <button
              onClick={() => {
                if (voiceState === 'speaking') {
                  if (currentAudioElemRef.current) currentAudioElemRef.current.pause();
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  startListening();
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
                {volumeLevel > 5 ? 'جيميني يستمع إليك...' : 'تحدث الآن...'}
              </span>
            </div>
          )}

          {/* Status Label */}
          <div className="text-center space-y-1">
            <span className="text-base font-bold tracking-wider text-slate-100 block">
              {voiceState === 'listening' && 'البوب يستمع إليك مباشرة.. تفضل بالتحدث'}
              {voiceState === 'processing' && 'جاري معالجة الصوت وتوليد الرد بصوت جيميني...'}
              {voiceState === 'speaking' && '«البوب» يتحدث بصوت جيميني الطبيعي...'}
              {voiceState === 'idle' && 'اضغط على الدائرة لاستئناف التحدث'}
            </span>
            <p className="text-xs text-slate-400">
              {voiceState === 'listening'
                ? 'تحدث بسؤالك، وبمجرد سكوتك سيجيبك صوت جيميني فوراً'
                : voiceState === 'speaking'
                ? 'انقر على الدائرة في أي وقت لمقاطعة الرد وطرح سؤال جديد'
                : 'مكالمة صوتية ذكية متصلة بنموذج جيميني الصوتي المباشر'}
            </p>
          </div>

          {/* Quick Voice Prompt Chips */}
          {voiceState === 'listening' && (
            <div className="w-full space-y-1.5 pt-1">
              <span className="text-[11px] text-emerald-400 font-semibold block text-right">
                💡 أو اضغط لطرح أحد الأسئلة بصوت جيميني فوراً:
              </span>
              <div className="flex flex-col gap-1.5">
                {QUICK_VOICE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setUserTranscript(q);
                      executeGeminiLiveTurn({ text: q });
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

        {/* Bottom Actions: Voice Selector & End Call */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          {/* Voice Selector */}
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {GEMINI_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-3">
            {voiceState === 'listening' ? (
              <button
                onClick={stopListeningAndSubmit}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-full shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 rotate-180" />
                <span>أجب الآن</span>
              </button>
            ) : voiceState === 'speaking' ? (
              <button
                onClick={() => {
                  if (currentAudioElemRef.current) currentAudioElemRef.current.pause();
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  startListening();
                }}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs rounded-full shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>مقاطعة والتحدث</span>
              </button>
            ) : (
              <button
                onClick={startListening}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-full shadow-lg transition flex items-center gap-1.5 cursor-pointer"
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
