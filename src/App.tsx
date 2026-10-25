import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Message } from './types';
import { KeyRound, ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';

const INITIAL_MESSAGE: Message = {
  id: 'welcome-msg',
  role: 'model',
  content: `مرحباً بك، أنا «البوب»! 
مساعدك المعتمد لمادة المحاسبة المالية بالبكالوريا المصرية (الصف الثاني، الجزء الأول والجزء الثاني).

أنا جاهز لتقديم إجابات نموذجية حصرية ومباشرة طبقاً لملفات المنهج المعتمدة وقالب JRE (الحكم + التفسير + الدليل)، بالإضافة إلى حل التمارين وقيود اليومية والقوائم المالية.

تفضل بكتابة سؤالك أو تحدث عبر المايك مباشرة 🎙️`,
  timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
};

const VALID_KEYS = ['ELBOB', 'elbob', '2026', 'البوب', '1234'];

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('elbob_app_unlocked') === 'true';
  });
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState('');

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('elbob_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Clean out any past error messages
          const cleaned = parsed.filter(
            (m: Message) => !m.content?.includes('عذراً، حدث انقطاع')
          );
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch (e) {
      console.error('History load error:', e);
    }
    return [INITIAL_MESSAGE];
  });

  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save history
  useEffect(() => {
    try {
      localStorage.setItem('elbob_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.error('History save error:', e);
    }
  }, [messages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passkeyInput.trim();
    if (VALID_KEYS.includes(trimmed)) {
      setIsUnlocked(true);
      localStorage.setItem('elbob_app_unlocked', 'true');
      setPasskeyError('');
    } else {
      setPasskeyError('مفتاح غير صحيح. جرب: ELBOB أو 2026');
    }
  };

  const handleLockApp = () => {
    setIsUnlocked(false);
    localStorage.removeItem('elbob_app_unlocked');
    setPasskeyInput('');
    setPasskeyError('');
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    const modelMsgId = `model-${Date.now()}`;
    const initialModelMsg: Message = {
      id: modelMsgId,
      role: 'model',
      content: 'جاري التفكير وصياغة الإجابة النموذجية...',
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, initialModelMsg]);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Prepare messages payload, filtering out introductory model message
      const chatPayload = updatedMessages
        .filter((m) => m.id !== 'welcome-msg')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatPayload }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `خطأ في الخادم (${response.status})`);
      }

      const data = await response.json();
      if (data && data.text) {
        setMessages((prev) =>
          prev.map((m) => (m.id === modelMsgId ? { ...m, content: data.text } : m))
        );
      } else {
        throw new Error('لم يتم استلام نص الإجابة');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Chat error:', error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsgId
              ? {
                  ...m,
                  content: `⚠️ تعذر استلام الإجابة: ${error.message || 'خطأ في الاتصال'}\n\nيمكنك النقر على زر إعادة المحاولة أدناه.`,
                }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleResetChat = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setMessages([INITIAL_MESSAGE]);
    localStorage.removeItem('elbob_chat_history');
  };

  const handleRetryLast = () => {
    // Find the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // Remove the last model error message and re-send
      setMessages((prev) => prev.slice(0, -1));
      handleSendMessage(lastUserMsg.content);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-4 font-sans">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
            <KeyRound className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-emerald-400 tracking-wide">البوب</h1>
            <p className="text-xs text-slate-400 mt-1">
              مطلوب مفتاح الدخول لاستخدام التطبيق
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4 text-right">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                مفتاح التطبيق (رمز المرور):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={passkeyInput}
                  onChange={(e) => {
                    setPasskeyInput(e.target.value);
                    setPasskeyError('');
                  }}
                  placeholder="اكتب المفتاح هنا (مثال: ELBOB)"
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none text-center font-mono tracking-wider"
                />
              </div>
              {passkeyError && (
                <p className="text-[11px] text-rose-400 mt-1.5 text-center font-medium">
                  {passkeyError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm py-2.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>دخول التطبيق</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>

          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>المفتاح الافتراضي للتطبيق: <strong className="text-emerald-300 font-mono">ELBOB</strong> أو <strong className="text-emerald-300 font-mono">2026</strong></span>
          </div>
        </div>
      </div>
    );
  }

  const hasErrorMessage = messages.some((m) => m.content.includes('⚠️ تعذر استلام الإجابة'));

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Header
        onResetChat={handleResetChat}
        hasMessages={messages.length > 1}
        onLockApp={handleLockApp}
      />

      <main className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto p-4 sm:p-5 space-y-3">
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          return (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={isLast && isLoading && message.role === 'model'}
            />
          );
        })}

        {hasErrorMessage && !isLoading && (
          <div className="flex justify-center pt-1">
            <button
              onClick={handleRetryLast}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-emerald-400 rounded-xl shadow transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة الآن</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        onStopGeneration={handleStopGeneration}
      />
    </div>
  );
}
