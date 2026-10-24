import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Message } from './types';

const INITIAL_MESSAGE: Message = {
  id: 'welcome-msg',
  role: 'model',
  content: `مرحباً بك، أنا «البوب»! 
مساعدك المعتمد لمادة المحاسبة المالية بالبكالوريا المصرية (الصف الثاني، الجزء الأول والجزء الثاني).

أنا جاهز لتقديم إجابات نموذجية حصرية ومباشرة طبقاً لملفات المنهج المعتمدة وقالب JRE (الحكم + التفسير + الدليل)، بالإضافة إلى حل التمارين وقيود اليومية والقوائم المالية.

تفضل بكتابة سؤالك أو تحدث عبر المايك مباشرة 🎙️`,
  timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('elbob_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
      content: '',
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, initialModelMsg]);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const chatPayload = updatedMessages.map((m) => ({
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
        throw new Error(`خطأ في استجابة الخادم (${response.status})`);
      }

      if (!response.body) {
        throw new Error('لا توجد بيانات قادمة');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                fullText += parsed.text;
                setMessages((prev) =>
                  prev.map((m) => (m.id === modelMsgId ? { ...m, content: fullText } : m))
                );
              } else if (parsed.error) {
                fullText += `\n⚠️ ${parsed.error}`;
                setMessages((prev) =>
                  prev.map((m) => (m.id === modelMsgId ? { ...m, content: fullText } : m))
                );
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Chat error:', error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsgId
              ? {
                  ...m,
                  content:
                    m.content ||
                    'عذراً، حدث انقطاع في الاتصال بالخادم. يرجى المحاولة مرة أخرى.',
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header: Pure and clean with only 'البوب' */}
      <Header onResetChat={handleResetChat} hasMessages={messages.length > 1} />

      {/* Clean Chat Thread */}
      <main className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto p-4 sm:p-5 space-y-3">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          return (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={isLastMessage && isLoading && message.role === 'model'}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Input bar with working mic */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        onStopGeneration={handleStopGeneration}
      />
    </div>
  );
}
