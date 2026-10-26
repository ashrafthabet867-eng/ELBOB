import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Volume2, Sparkles, PhoneOff, AlertCircle, Send, ArrowRight } from 'lucide-react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewMessagePair: (userText: string, modelText: string) => void;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

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
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const isClosingRef = useRef(false);
  const liveTranscriptRef = useRef('');

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      setUserTranscript('');
      setErrorMessage('');
      setModelResponse('أهلاً بك! أنا «البوب». اضغط على المايك وتحدث فوراً، وسأجيبك صوتياً في ثانية واحدة.');
    } else {
      isClosingRef.current = true;
      stopAll();
    }
    return () => {
      stopAll();
    };
  }, [isOpen]);

  const stopAll = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (timerRef.current) clearInterval(timerRef.current);
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

  // Start recording voice with direct user gesture
  const startListening = async () => {
    if (isClosingRef.current) return;
    setErrorMessage('');
    setUserTranscript('');
    liveTranscriptRef.current = '';

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('المتصفح لا يدعم الوصول المباشر للمايك.');
        return;
      }

      // 1. Acquire microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Set up Web Audio volume meter for live feedback
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

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

            // Auto-submit on silence: when user stops talking after having spoken
            if (liveTranscriptRef.current.trim().length > 3) {
              if (currentVol < 10) {
                if (!silenceTimerRef.current) {
                  silenceTimerRef.current = setTimeout(() => {
                    stopListeningAndSubmit();
                  }, 1400); // 1.4s of silence triggers auto-answer!
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
        console.warn('Analyser not available:', e);
      }

      // 3. Set up SpeechRecognition with auto-submit on end
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'ar-EG';
          recognition.continuous = false; // Ends automatically when user stops speaking!
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
            // When user finishes speaking, auto-submit!
            setTimeout(() => {
              stopListeningAndSubmit();
            }, 300);
          };

          recognition.onend = () => {
            if (liveTranscriptRef.current.trim().length > 1) {
              stopListeningAndSubmit();
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('SpeechRecognition notice:', e);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition failed:', e);
        }
      }

      // 4. MediaRecorder as parallel audio stream
      audioChunksRef.current = [];
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
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

        // If we already have the transcript from speech recognition, submit it immediately!
        const recognized = liveTranscriptRef.current.trim();
        if (recognized.length > 1) {
          submitQuestion(recognized);
          return;
        }

        // Otherwise transcribe recorded blob
        const finalBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        if (finalBlob.size > 0) {
          transcribeAndSubmit(finalBlob);
        } else {
          setVoiceState('idle');
          setErrorMessage('لم يتم التقاط أي صوت، يرجى التحدث بوضوح في المايك.');
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setVoiceState('listening');
      setSeconds(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic error:', err);
      setVoiceState('idle');
      setErrorMessage(
        'يرجى السماح بالوصول للمايك: اضغط على علامة القفل بجانب رابط الموقع واختر السماح بالمايكروفون.'
      );
    }
  };

  const stopListeningAndSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
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

  // Transcribe recorded audio
  const transcribeAndSubmit = async (audioBlob: Blob) => {
    setVoiceState('processing');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: audioBlob.type || 'audio/webm',
          }),
        });

        const data = await res.json();
        const spoken = data.text?.trim() || '';

        if (!spoken) {
          setVoiceState('idle');
          setErrorMessage('لم يتم تمييز الكلام. يرجى التحدث مرة أخرى بوضوح أو استخدام الأسئلة السريعة.');
          return;
        }

        setUserTranscript(spoken);
        submitQuestion(spoken);
      };
    } catch (e) {
      console.error('Transcribe error:', e);
      setVoiceState('idle');
      setErrorMessage('حدث خطأ أثناء معالجة الصوت.');
    }
  };

  // Submit question and speak answer with ultra-fast speed
  const submitQuestion = async (queryText: string) => {
    setVoiceState('processing');

    try {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: queryText }],
        }),
      });

      const chatData = await chatRes.json();
      const reply = chatData.text?.trim() || 'عذراً، لم أتمكن من الحصول على إجابة، يرجى المحاولة ثانية.';

      setModelResponse(reply);
      onNewMessagePair(queryText, reply);

      speakAnswer(reply);
    } catch (err: any) {
      console.error('Chat error in voice modal:', err);
      setVoiceState('idle');
      setErrorMessage('حدث خطأ أثناء الاتصال بالخادم.');
    }
  };

  // Arabic voice synthesis
  const speakAnswer = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setVoiceState('idle');
      return;
    }

    window.speechSynthesis.cancel();
    setVoiceState('speaking');

    const cleanSpoken = text
      .replace(/[#*`_~|]/g, '')
      .replace(/\|.*\|/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpoken);
    utterance.lang = 'ar-SA';
    utterance.rate = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang.startsWith('ar'));
    if (arVoice) utterance.voice = arVoice;

    utterance.onend = () => {
      setVoiceState('idle');
    };
    utterance.onerror = () => {
      setVoiceState('idle');
    };

    window.speechSynthesis.speak(utterance);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/95 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg h-[90vh] max-h-[740px] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                voiceState === 'listening'
                  ? 'bg-rose-500 animate-ping'
                  : voiceState === 'speaking'
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-emerald-500'
              }`}
            />
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
              محادثة صوتية مباشرة مع «البوب»
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="إغلاق المحادثة الصوتية"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Orb & Animated Volume Visualizer */}
        <div className="my-auto flex flex-col items-center justify-center space-y-4">
          <div className="relative flex items-center justify-center">
            {/* Glowing outer aura */}
            <div
              className={`absolute w-44 h-44 rounded-full transition-all duration-300 ${
                voiceState === 'listening'
                  ? 'bg-rose-500/25 scale-125 animate-ping'
                  : voiceState === 'speaking'
                  ? 'bg-emerald-500/25 scale-125 animate-pulse'
                  : voiceState === 'processing'
                  ? 'bg-sky-500/25 scale-110 animate-spin'
                  : 'bg-emerald-500/10 scale-100'
              }`}
            />

            {/* Main Interactive Mic Button */}
            <button
              onClick={voiceState === 'listening' ? stopListeningAndSubmit : startListening}
              className={`relative w-32 sm:w-36 h-32 sm:h-36 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 border-2 cursor-pointer ${
                voiceState === 'listening'
                  ? 'bg-gradient-to-tr from-rose-600 to-amber-500 border-rose-400 shadow-rose-950/60 scale-105'
                  : voiceState === 'speaking'
                  ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 border-emerald-300 shadow-emerald-950/60 scale-105'
                  : voiceState === 'processing'
                  ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 border-sky-400 shadow-sky-950/60'
                  : 'bg-gradient-to-tr from-emerald-700 to-teal-800 border-emerald-400 shadow-lg hover:scale-105'
              }`}
            >
              {voiceState === 'listening' ? (
                <Mic className="w-12 sm:w-14 h-12 sm:h-14 text-white animate-bounce" />
              ) : voiceState === 'speaking' ? (
                <Volume2 className="w-12 sm:w-14 h-12 sm:h-14 text-white animate-pulse" />
              ) : voiceState === 'processing' ? (
                <Sparkles className="w-10 sm:w-12 h-10 sm:h-12 text-white animate-spin" />
              ) : (
                <Mic className="w-12 sm:w-14 h-12 sm:h-14 text-white" />
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
                    className="w-1.5 bg-rose-500 rounded-full transition-all duration-75"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
              <span className="text-[11px] text-rose-300 mr-2 font-mono">
                {volumeLevel > 5 ? 'المايك يلتقط صوتك بنجاح' : 'تحدث الآن...'}
              </span>
            </div>
          )}

          {/* Status Label */}
          <div className="text-center space-y-1">
            <span className="text-sm font-bold tracking-wider text-slate-200 block">
              {voiceState === 'listening' && `البوب يستمع إليك (${seconds} ثانية)...`}
              {voiceState === 'processing' && 'البوب يجيبك فوراً...'}
              {voiceState === 'speaking' && 'البوب يشرح لك الإجابة صوتياً...'}
              {voiceState === 'idle' && 'اضغط على الدائرة الخضراء وتحدث مباشرة'}
            </span>
            <p className="text-xs text-slate-400">
              {voiceState === 'listening'
                ? 'تحدث، وعندما تسكت سيجيبك البوب تلقائياً في ثانية واحدة'
                : voiceState === 'speaking'
                ? 'استمع للشرح أو انقر للمقاطعة'
                : 'أو اضغط على أي سؤال سريع بالأسفل للرد الفوري'}
            </p>
          </div>

          {/* Quick Voice Prompt Chips */}
          {voiceState === 'idle' && (
            <div className="w-full space-y-1.5 pt-1">
              <span className="text-[11px] text-emerald-400/90 font-semibold block text-right">
                💡 جرّب صوتاً بنقرة واحدة:
              </span>
              <div className="flex flex-col gap-1.5">
                {QUICK_VOICE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setUserTranscript(q);
                      submitQuestion(q);
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
              <span className="font-bold text-emerald-400">البوب: </span>
              <span>{modelResponse}</span>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-center gap-3 pt-3 border-t border-slate-800">
          {voiceState === 'listening' ? (
            <button
              onClick={stopListeningAndSubmit}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4 rotate-180" />
              <span>أرسل السؤال للبوب</span>
            </button>
          ) : voiceState === 'speaking' ? (
            <button
              onClick={() => {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                setVoiceState('idle');
                startListening();
              }}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <span>مقاطعة وسؤال جديد</span>
            </button>
          ) : (
            <button
              onClick={startListening}
              disabled={voiceState === 'processing'}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              <span>تحدث مع البوب</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full transition cursor-pointer"
            title="إنهاء المحادثة الصوتية"
          >
            <PhoneOff className="w-5 h-5 text-rose-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
