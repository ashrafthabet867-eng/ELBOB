import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { VoiceModal } from './components/VoiceModal';
import { Message, Attachment } from './types';
import { RefreshCw } from 'lucide-react';

const INITIAL_MESSAGE: Message = {
  id: 'welcome-msg',
  role: 'model',
  content: `مرحباً بك، أنا «البوب»! 
مساعدك المعتمد لمادة المحاسبة المالية بالبكالوريا المصرية (الصف الثاني، الجزء الأول والجزء الثاني).

يمكنك الآن:
1. كتابة أي سؤال أو مسألة حسابية مباشرة ✍️.
2. إرفاق صورة تمرين أو ملف PDF لحله خطوة بخطوة 📎.
3. بدء محادثة صوتية مباشرة والتحدث بالصوت 🎙️.

تفضل بطرح أي سؤال وسأجيبك بنموذجية تامة فوراً!`,
  timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
};

export default function App() {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('elbob_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(
            (m: Message) =>
              !m.content?.startsWith('⚠️') &&
              !m.content?.includes('تعذر استلام') &&
              !m.content?.includes('انقطاع')
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

  // Save clean history
  useEffect(() => {
    try {
      const cleanToSave = messages.filter(
        (m) =>
          !m.content?.startsWith('⚠️') &&
          !m.content?.includes('تعذر استلام') &&
          !m.content?.includes('جاري التفكير') &&
          !m.content?.includes('جاري فحص المسألة')
      );
      localStorage.setItem('elbob_chat_history', JSON.stringify(cleanToSave));
    } catch (e) {
      console.error('History save error:', e);
    }
  }, [messages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (
    text: string,
    attachment?: Attachment,
    baseMessages?: Message[]
  ) => {
    if ((!text.trim() && !attachment) || isLoading) return;

    const currentList = (baseMessages || messages).filter(
      (m) =>
        !m.content?.startsWith('⚠️') &&
        !m.content?.includes('تعذر استلام') &&
        !m.content?.includes('جاري التفكير') &&
        !m.content?.includes('جاري فحص المسألة')
    );

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      attachment,
    };

    const modelMsgId = `model-${Date.now()}`;
    const initialModelMsg: Message = {
      id: modelMsgId,
      role: 'model',
      content: 'جاري فحص المسألة وصياغة الإجابة النموذجية...',
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...currentList, userMsg];
    setMessages([...updatedMessages, initialModelMsg]);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const chatPayload = updatedMessages
        .filter((m) => m.id !== 'welcome-msg')
        .map((m) => ({
          role: m.role,
          content: m.content,
          attachment: m.attachment,
        }));

      let response: Response;
      try {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chatPayload }),
          signal: abortController.signal,
        });

        if (!response.ok && (response.status === 500 || response.status === 503)) {
          await new Promise((r) => setTimeout(r, 600));
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatPayload }),
            signal: abortController.signal,
          });
        }
      } catch (networkErr: any) {
        if (networkErr.name === 'AbortError') throw networkErr;
        await new Promise((r) => setTimeout(r, 600));
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chatPayload }),
          signal: abortController.signal,
        });
      }

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

  const handleNewMessagePair = (userText: string, modelText: string) => {
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: time,
    };
    const modelMsg: Message = {
      id: `model-${Date.now() + 1}`,
      role: 'model',
      content: modelText,
      timestamp: time,
    };
    setMessages((prev) => [...prev, userMsg, modelMsg]);
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
    const cleanList = messages.filter(
      (m) =>
        !m.content?.startsWith('⚠️') &&
        !m.content?.includes('تعذر استلام') &&
        !m.content?.includes('جاري التفكير') &&
        !m.content?.includes('جاري فحص المسألة')
    );
    const lastUserMsg = [...cleanList].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      handleSendMessage(
        lastUserMsg.content,
        lastUserMsg.attachment,
        cleanList.filter((m) => m.id !== lastUserMsg.id)
      );
    }
  };

  const hasErrorMessage = messages.some((m) => m.content.includes('⚠️ تعذر استلام الإجابة'));

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Header
        onResetChat={handleResetChat}
        hasMessages={messages.length > 1}
        onOpenVoiceMode={() => setIsVoiceModalOpen(true)}
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
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-emerald-400 rounded-xl shadow transition cursor-pointer"
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

      {/* Dedicated High-Speed Voice Chat Modal */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onNewMessagePair={handleNewMessagePair}
      />
    </div>
  );
}
