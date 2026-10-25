import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Volume2, Sparkles, PhoneOff, RotateCcw } from 'lucide-react';
import { Message } from '../types';

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
  const [isMuted, setIsMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isClosingRef = useRef(false);

  // Reset when opened/closed
  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      setUserTranscript('');
      setModelResponse('أهلاً بك يا بطل! أنا أستمع إليك، تفضل بطرح أي مسألة أو سؤال في المحاسبة.');
      speakText('أهلاً بك يا بطل! أنا أستمع إليك، تفضل بطرح أي سؤال أو مسألة في المحاسبة.', () => {
        if (!isClosingRef.current) {
          startListening();
        }
      });
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setVoiceState('idle');
  };

  // Start listening to student's voice
  const startListening = async () => {
    if (isClosingRef.current || isMuted) return;

    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

        if (isClosingRef.current) return;

        const finalBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        if (finalBlob.size > 500) {
          processVoiceInput(finalBlob);
        } else {
          setVoiceState('idle');
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
    } catch (err) {
      console.error('Mic access error in voice modal:', err);
      setVoiceState('idle');
    }
  };

  const stopListening = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Send voice to transcribe + chat API
  const processVoiceInput = async (audioBlob: Blob) => {
    setVoiceState('processing');

    try {
      // 1. Transcribe voice audio
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: audioBlob.type || 'audio/webm',
          }),
        });

        const transcribeData = await transcribeRes.json();
        const spokenText = transcribeData.text?.trim() || '';

        if (!spokenText) {
          setModelResponse('لم أتمكن من سماعك بوضوح، يرجى التحدث مرة أخرى.');
          speakText('لم أتمكن من سماعك بوضوح، يرجى التحدث مرة أخرى.', () => {
            if (!isClosingRef.current) startListening();
          });
          return;
        }

        setUserTranscript(spokenText);

        // 2. Query Gemini chat with spokenText
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: spokenText }],
          }),
        });

        const chatData = await chatRes.json();
        const reply = chatData.text?.trim() || 'عذراً، حدث خطأ، يرجى المحاولة مرة أخرى.';
        setModelResponse(reply);

        // Add to main chat history
        onNewMessagePair(spokenText, reply);

        // 3. Speak the answer aloud
        speakText(reply, () => {
          if (!isClosingRef.current && !isMuted) {
            // Automatically listen again for natural flow!
            setTimeout(() => {
              if (!isClosingRef.current) startListening();
            }, 600);
          }
        });
      };
    } catch (err) {
      console.error('Voice processing error:', err);
      setVoiceState('idle');
      setModelResponse('حدث خطأ في معالجة الصوت، حاول مرة أخرى.');
    }
  };

  // Text-To-Speech with Arabic voice
  const speakText = (text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      setVoiceState('idle');
      if (onEnd) onEnd();
      return;
    }

    window.speechSynthesis.cancel();
    setVoiceState('speaking');

    // Remove markdown symbols and raw table syntax for clean spoken speech
    const cleanSpoken = text
      .replace(/[#*`_~]/g, '')
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
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      setVoiceState('idle');
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-lg h-[90vh] max-h-[720px] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
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

        {/* Center Orb & Wave Visualizer */}
        <div className="my-auto flex flex-col items-center justify-center space-y-6">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring aura */}
            <div
              className={`absolute w-44 h-44 rounded-full transition-all duration-700 ${
                voiceState === 'listening'
                  ? 'bg-rose-500/20 scale-125 animate-ping'
                  : voiceState === 'speaking'
                  ? 'bg-emerald-500/25 scale-125 animate-pulse'
                  : voiceState === 'processing'
                  ? 'bg-sky-500/25 scale-110 animate-spin'
                  : 'bg-slate-800/20 scale-100'
              }`}
            />

            <div
              className={`relative w-36 h-36 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border-2 ${
                voiceState === 'listening'
                  ? 'bg-gradient-to-tr from-rose-600 to-amber-500 border-rose-400 shadow-rose-950/60 scale-105'
                  : voiceState === 'speaking'
                  ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 border-emerald-300 shadow-emerald-950/60 scale-105'
                  : voiceState === 'processing'
                  ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 border-sky-400 shadow-sky-950/60'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              {voiceState === 'listening' ? (
                <Mic className="w-14 h-14 text-white animate-bounce" />
              ) : voiceState === 'speaking' ? (
                <Volume2 className="w-14 h-14 text-white animate-pulse" />
              ) : voiceState === 'processing' ? (
                <Sparkles className="w-12 h-12 text-white animate-spin" />
              ) : (
                <Mic className="w-12 h-12 text-slate-400" />
              )}
            </div>
          </div>

          {/* Status Label */}
          <div className="text-center space-y-1">
            <span className="text-sm font-bold tracking-wider text-slate-200">
              {voiceState === 'listening' && `البوب يستمع إليك... (${seconds} ث)`}
              {voiceState === 'processing' && 'البوب يحلل سؤالك ويجهز الإجابة...'}
              {voiceState === 'speaking' && 'البوب يتحدث الآن...'}
              {voiceState === 'idle' && 'انقر على المايك للتحدث مع البوب'}
            </span>
            <p className="text-xs text-slate-400">
              {voiceState === 'listening'
                ? 'تحدث بمسألتك أو سؤالك في المحاسبة بحرية'
                : voiceState === 'speaking'
                ? 'يمكنك مقاطعة البوب في أي وقت بالنقر على الزر'
                : 'دقة عالية في فهم المصطلحات المحاسبية المصرية'}
            </p>
          </div>
        </div>

        {/* Subtitles / Live Transcript Area */}
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

        {/* Bottom Voice Controls */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-800/80">
          {voiceState === 'listening' ? (
            <button
              onClick={stopListening}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg transition flex items-center gap-2 cursor-pointer"
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
              className="px-6 py-3 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <span>مقاطعة والتحدث مجدداً</span>
            </button>
          ) : (
            <button
              onClick={startListening}
              disabled={voiceState === 'processing'}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              <span>تحدث مع البوب</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full transition"
            title="إنهاء المكالمة الصوتية"
          >
            <PhoneOff className="w-5 h-5 text-rose-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
