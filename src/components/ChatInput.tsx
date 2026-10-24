import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  onStopGeneration,
}) => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Robust Audio Recording using MediaRecorder + Backend Gemini Transcription
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('متصفحك لا يدعم تسجيل الصوت.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // browser default
        }
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());

        const finalBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        if (finalBlob.size > 0) {
          setIsTranscribing(true);
          try {
            const reader = new FileReader();
            reader.readAsDataURL(finalBlob);
            reader.onloadend = async () => {
              const base64Data = (reader.result as string).split(',')[1];
              const res = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64Data,
                  mimeType: finalBlob.type || 'audio/webm',
                }),
              });

              const data = await res.json();
              if (data.text) {
                setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
              } else if (data.error) {
                alert(`تعذر التقاط الصوت: ${data.error}`);
              }
              setIsTranscribing(false);
            };
          } catch (err) {
            console.error('Transcription error:', err);
            setIsTranscribing(false);
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      alert('تعذر الوصول إلى الميكروفون. يرجى التأكد من السماح بالوصول للميكروفون في المتصفح.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="border-t border-slate-800/80 bg-slate-900/95 p-3 sm:p-4 backdrop-blur-md">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Active Recording or Transcribing Status */}
        {isRecording && (
          <div className="flex items-center justify-between bg-rose-950/60 border border-rose-500/40 rounded-xl px-3.5 py-1.5 text-xs text-rose-300 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>جارٍ الاستماع... ({recordingSeconds} ثانية)</span>
            </div>
            <button
              onClick={stopRecording}
              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1 rounded-lg transition"
            >
              تم، حوّل إلى نص
            </button>
          </div>
        )}

        {isTranscribing && (
          <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs text-emerald-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>جارٍ تفريغ الصوت بدقة عبر Gemini 3.5 Transcribe...</span>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-2 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2 focus-within:border-emerald-500 transition shadow-inner">
          {/* Working Microphone Button */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isTranscribing}
            className={`p-2.5 rounded-xl transition shrink-0 ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
            }`}
            title={isRecording ? 'إيقاف التسجيل' : 'تحدث بالسؤال عبر المايك'}
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'تحدث الآن، صوتك قيد التسجيل...' : 'اكتب سؤالك في المحاسبة...'}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none focus:outline-none p-1.5 leading-relaxed"
          />

          {/* Action Button: Send or Stop */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shrink-0 transition"
              title="إيقاف"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className={`p-2.5 rounded-xl shrink-0 transition flex items-center justify-center ${
                input.trim()
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                  : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              }`}
              title="إرسال"
            >
              <Send className="w-4 h-4 rotate-180" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
