import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, Loader2, Paperclip, X, FileText } from 'lucide-react';
import { Attachment } from '../types';

interface ChatInputProps {
  onSendMessage: (text: string, attachment?: Attachment) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  onStopGeneration,
}) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<any>(null);
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
    if ((!input.trim() && !attachment) || isLoading) return;
    onSendMessage(input.trim(), attachment || undefined);
    setInput('');
    setAttachment(null);
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

  // Handle File / Image upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('الحد الأقصى لحجم الملف هو 20 ميجابايت.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      setAttachment({
        type: isImage ? 'image' : 'file',
        mimeType: file.type || (isImage ? 'image/jpeg' : 'application/pdf'),
        data: base64Data,
        name: file.name,
        size: file.size,
      });
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Dual Audio Recording: Real-time SpeechRecognition + MediaRecorder fallback
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('متصفحك لا يدعم تسجيل الصوت.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 1. Try real-time browser recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      let recognizedLiveText = '';
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.lang = 'ar-EG';
          rec.continuous = true;
          rec.interimResults = true;

          rec.onresult = (ev: any) => {
            let res = '';
            for (let i = ev.resultIndex; i < ev.results.length; ++i) {
              res += ev.results[i][0].transcript;
            }
            if (res) {
              recognizedLiveText = res;
              setInput((prev) => (prev ? `${prev} ${res}` : res));
            }
          };

          rec.start();
          speechRecognitionRef.current = rec;
        } catch (e) {
          console.warn('SpeechRecognition not available:', e);
        }
      }

      // 2. MediaRecorder for Gemini Transcribe fallback
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

        // If SpeechRecognition already gave us text, we're done!
        if (recognizedLiveText.trim().length > 1) {
          return;
        }

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
        {/* Attachment preview if selected */}
        {attachment && (
          <div className="flex items-center justify-between bg-slate-800/90 border border-slate-700 rounded-xl p-2 px-3 text-xs text-slate-200">
            <div className="flex items-center gap-2 truncate">
              {attachment.type === 'image' ? (
                <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-600 shrink-0">
                  <img
                    src={`data:${attachment.mimeType};base64,${attachment.data}`}
                    alt="مرفق"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <div className="truncate">
                <span className="font-semibold block truncate">{attachment.name}</span>
                <span className="text-[10px] text-slate-400">
                  {attachment.type === 'image' ? 'صورة مرفقة' : 'ملف / مستند'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setAttachment(null)}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-lg transition cursor-pointer"
              title="إزالة المرفق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Recording or Transcribing Status */}
        {isRecording && (
          <div className="flex items-center justify-between bg-rose-950/60 border border-rose-500/40 rounded-xl px-3.5 py-1.5 text-xs text-rose-300 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>المايك يستمع... ({recordingSeconds} ثانية)</span>
            </div>
            <button
              onClick={stopRecording}
              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              تم، حوّل إلى نص
            </button>
          </div>
        )}

        {isTranscribing && (
          <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs text-emerald-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>جارٍ تفريغ الصوت بدقة عالية...</span>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-1.5 sm:gap-2 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2 focus-within:border-emerald-500 transition shadow-inner">
          {/* File attachment button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.pdf,application/pdf"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 transition shrink-0 cursor-pointer"
            title="إرفاق صورة مسألة أو ملف PDF"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Microphone Button */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isTranscribing}
            className={`p-2.5 rounded-xl transition shrink-0 cursor-pointer ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
            }`}
            title={isRecording ? 'إيقاف التسجيل' : 'إملاء صوتي بالمايك'}
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
            placeholder={
              attachment
                ? 'أضف استفساراً مع المرفق (اختياري)...'
                : 'اكتب سؤالك أو أرفق صورة المسألة...'
            }
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none focus:outline-none p-1.5 leading-relaxed"
          />

          {/* Action Button: Send or Stop */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shrink-0 transition cursor-pointer"
              title="إيقاف"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() && !attachment}
              className={`p-2.5 rounded-xl shrink-0 transition flex items-center justify-center ${
                input.trim() || attachment
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
