import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Volume2, Sparkles, PhoneOff, AlertCircle } from 'lucide-react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewMessagePair: (userText: string, modelText: string) => void;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

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
  const isClosingRef = useRef(false);

  // Initialize modal
  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      setUserTranscript('');
      setErrorMessage('');
      setModelResponse('أهلاً بك! أنا «البوب». اضغط على زر المايك وتفضل بطرح أي مسألة أو سؤال في المحاسبة.');
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

  // Start recording voice with direct user click
  const startListening = async () => {
    if (isClosingRef.current) return;
    setErrorMessage('');
    setUserTranscript('');

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('المتصفح لا يدعم الوصول للميكروفون.');
        return;
      }

      // 1. Acquire microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Set up live volume analyser to show real visual feedback
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
            setVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (e) {
        console.warn('Web Audio Analyser not supported:', e);
      }

      // 3. Set up parallel browser SpeechRecognition for live transcription
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      let recognizedLiveText = '';
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'ar-EG';
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              interim += event.results[i][0].transcript;
            }
            if (interim) {
              recognizedLiveText = interim;
              setUserTranscript(interim);
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('SpeechRecognition error, falling back to MediaRecorder:', e);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('SpeechRecognition start error:', e);
        }
      }

      // 4. Set up MediaRecorder as resilient recording fallback
      audioChunksRef.current = [];
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setVolumeLevel(0);

        if (isClosingRef.current) return;

        // If SpeechRecognition already gave us live text, use it directly!
        if (recognizedLiveText && recognizedLiveText.trim().length > 1) {
          submitQuestion(recognizedLiveText.trim());
          return;
        }

        // Otherwise transcribe the recorded audio via Gemini
        const finalBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        if (finalBlob.size > 0) {
          transcribeAndSubmit(finalBlob);
        } else {
          setVoiceState('idle');
          setErrorMessage('لم يتم التقاط أي صوت، يرجى التحدث بوضوح.');
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
      console.error('Mic access error:', err);
      setVoiceState('idle');
      setErrorMessage(
        'تعذر الوصول إلى الميكروفون. يرجى التأكد من الضغط على "سماح" (Allow) لإذن المايك في المتصفح.'
      );
    }
  };

  const stopListening = () => {
    if (timerRef.current) clearInterval(timerRef.current);
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

  // Transcribe audio using backend Gemini 3.5 Transcribe
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
          setErrorMessage('لم يتم التعرف على الصوت. يرجى التحدث مرة أخرى بوضوح.');
          return;
        }

        setUserTranscript(spoken);
        submitQuestion(spoken);
      };
    } catch (e) {
      console.error('Transcribe error:', e);
      setVoiceState('idle');
      setErrorMessage('حدث خطأ أثناء تفريغ الصوت.');
    }
  };

  // Submit question text to /api/chat and speak answer
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
      const reply = chatData.text?.trim() || 'عذراً، لم أتمكن من إيجاد إجابة، يرجى إعادة المحاولة.';

      setModelResponse(reply);
      onNewMessagePair(queryText, reply);

      speakAnswer(reply);
    } catch (err: any) {
      console.error('Voice chat error:', err);
      setVoiceState('idle');
      setErrorMessage('حدث خطأ أثناء الاتصال بالخادم.');
    }
  };

  // Speak aloud using browser speech synthesis
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
    utterance.rate = 1.0;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg h-[88vh] max-h-[700px] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl overflow-hidden">
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
            <h3 className="text-base font-extrabold text-white tracking-wide">
              محادثة صوتية مباشرة مع «البوب»
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="إغلاق المحادثة الصوتية"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Orb & Animated Volume Visualizer */}
        <div className="my-auto flex flex-col items-center justify-center space-y-6">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring aura */}
            <div
              className={`absolute w-44 h-44 rounded-full transition-all duration-300 ${
                voiceState === 'listening'
                  ? 'bg-rose-500/20 scale-125 animate-ping'
                  : voiceState === 'speaking'
                  ? 'bg-emerald-500/25 scale-125 animate-pulse'
                  : voiceState === 'processing'
                  ? 'bg-sky-500/25 scale-110 animate-spin'
                  : 'bg-slate-800/20 scale-100'
              }`}
            />

            {/* Glowing Orb */}
            <button
              onClick={voiceState === 'listening' ? stopListening : startListening}
              className={`relative w-36 h-36 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 border-2 cursor-pointer ${
                voiceState === 'listening'
                  ? 'bg-gradient-to-tr from-rose-600 to-amber-500 border-rose-400 shadow-rose-950/60 scale-105'
                  : voiceState === 'speaking'
                  ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 border-emerald-300 shadow-emerald-950/60 scale-105'
                  : voiceState === 'processing'
                  ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 border-sky-400 shadow-sky-950/60'
                  : 'bg-gradient-to-tr from-slate-800 to-slate-700 border-emerald-500/50 hover:border-emerald-400 shadow-lg'
              }`}
            >
              {voiceState === 'listening' ? (
                <Mic className="w-14 h-14 text-white animate-bounce" />
              ) : voiceState === 'speaking' ? (
                <Volume2 className="w-14 h-14 text-white animate-pulse" />
              ) : voiceState === 'processing' ? (
                <Sparkles className="w-12 h-12 text-white animate-spin" />
              ) : (
                <Mic className="w-12 h-12 text-emerald-400" />
              )}
            </button>
          </div>

          {/* Live Waveform Indicator (Web Audio API volume level) */}
          {voiceState === 'listening' && (
            <div className="flex items-center gap-1.5 h-6">
              {[0.6, 1.2, 0.8, 1.5, 0.9, 1.3, 0.7].map((factor, i) => {
                const height = Math.max(4, Math.min(24, Math.round((volumeLevel * factor) / 4)));
                return (
                  <div
                    key={i}
                    className="w-1.5 bg-rose-500 rounded-full transition-all duration-75"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
              <span className="text-[11px] text-rose-300 mr-2 font-mono">
                {volumeLevel > 5 ? 'المايك يلتقط صوتك' : 'تحدث في المايك...'}
              </span>
            </div>
          )}

          {/* Status Label */}
          <div className="text-center space-y-1">
            <span className="text-sm font-bold tracking-wider text-slate-200">
              {voiceState === 'listening' && `البوب يستمع إليك الآن (${seconds} ثانية)...`}
              {voiceState === 'processing' && 'البوب يحلل سؤالك ويجهز الإجابة النموذجية...'}
              {voiceState === 'speaking' && 'البوب يشرح لك الإجابة الآن...'}
              {voiceState === 'idle' && 'اضغط على الدائرة الخضراء للتحدث'}
            </span>
            <p className="text-xs text-slate-400">
              {voiceState === 'listening'
                ? 'تحدث بسؤالك، ثم اضغط على الدائرة أو الزر لإرسال السؤال'
                : voiceState === 'speaking'
                ? 'استمع للشرح أو انقر للمقاطعة وطرح سؤال جديد'
                : 'دقة عالية في فهم الأسئلة المحاسبية باللغة العربية'}
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/60 border border-rose-500/30 px-3 py-1.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Live Subtitles & Transcripts */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 max-h-40 overflow-y-auto space-y-2 text-xs leading-relaxed">
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
        <div className="flex items-center justify-center gap-4 pt-3 border-t border-slate-800">
          {voiceState === 'listening' ? (
            <button
              onClick={stopListening}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <span>تم، أجب يا بوب</span>
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
              <span>مقاطعة والتحدث مجدداً</span>
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
