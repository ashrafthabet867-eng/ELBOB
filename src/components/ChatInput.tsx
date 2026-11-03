import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Paperclip, X, FileText } from 'lucide-react';
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="border-t border-slate-800 bg-slate-900/90 backdrop-blur p-3 sm:p-4 sticky bottom-0 z-20">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        {/* Attachment preview banner */}
        {attachment && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200">
            <div className="flex items-center gap-2 overflow-hidden">
              {attachment.type === 'image' ? (
                <img
                  src={`data:${attachment.mimeType};base64,${attachment.data}`}
                  alt="مرفق"
                  className="w-10 h-10 object-cover rounded-lg border border-slate-600"
                />
              ) : (
                <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <div className="truncate">
                <span className="font-semibold block truncate">{attachment.name}</span>
                <span className="text-[10px] text-slate-400">
                  {attachment.size ? `${Math.round(attachment.size / 1024)} ك.ب` : 'مرفق جاهز للحل'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setAttachment(null)}
              className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
              title="إلغاء المرفق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end gap-2 bg-slate-950 border border-slate-800 focus-within:border-emerald-500/60 rounded-2xl p-1.5 transition-all shadow-inner">
          {/* File attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 rounded-xl transition cursor-pointer shrink-0"
            title="إرفاق صورة مسألة أو ملف PDF"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب مسألتك أو سؤالك في المحاسبة المالية وسيجيبك البوب فوراً..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none resize-none py-2 px-1 max-h-36 min-h-[40px] leading-relaxed"
            dir="rtl"
          />

          {/* Send or Stop Button */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className="p-2.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/40 rounded-xl transition shrink-0 cursor-pointer"
              title="إيقاف التوليد"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() && !attachment}
              className={`p-2.5 rounded-xl transition shrink-0 cursor-pointer ${
                input.trim() || attachment
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                  : 'bg-slate-900 text-slate-600 cursor-not-allowed'
              }`}
              title="إرسال المسألة"
            >
              <Send className="w-5 h-5 rotate-180" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
