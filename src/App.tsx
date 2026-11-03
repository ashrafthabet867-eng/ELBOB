import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Message, Attachment } from './types';
import { RefreshCw } from 'lucide-react';

const INITIAL_MESSAGE: Message = {
  id: 'welcome-msg',
  role: 'model',
  content: `مرحباً بك، أنا «البوب»! 🎓
معلم ومساعد المحاسبة المالية المعتمد للصف الثاني الثانوي (البكالوريا المصرية 2026 - الجزء الأول والثاني).

جاهز لمساعدتك في:
1. 📝 كتابة أي سؤال أو مسألة حسابية لحلها بالخطوات الدقيقة.
2. 📎 إرفاق صورة تمرين أو صفحة من كتاب الوزارة لحلها فوراً بالتمهيد الحسابي وقيود اليومية.
3. 📊 إعداد الحسابات الختامية (المتاجرة، الأرباح والخسائر) وقوائم المركز المالي.
4. 💡 إجابات أسئلة الفهم والتعليل بمنهجية الوزارة الإلزامية JRE [الحكم + التفسير + الدليل].

تفضل بكتابة مسألتك أو إرفاق صورتها لنبدأ الحل النموذجي فوراً! 🚀`,
  timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
};

// Fast local matching for standard greetings to guarantee 100% instant response
function matchLocalGreeting(text: string): string | null {
  const clean = text.trim().toLowerCase().replace(/[!?.،؟]/g, '').replace(/\s+/g, ' ');

  if (
    /^(السلام عليكم|سلام عليكم|وعليكم السلام|السلام عليكم ورحمة الله|السلام عليكم ورحمة الله وبركاته|سلام)$/i.test(
      clean
    )
  ) {
    return `وعليكم السلام ورحمة الله وبركاته يا بطل! 🎓✨
أهلاً ومرحباً بك، معك «البوب» معلم ومساعد مادة المحاسبة المالية للصف الثاني الثانوي التجاري (المنهج المصري 2026).

أنا جاهز تماماً لمساعدتك في:
1. 📝 حل أي مسألة أو تمرين محاسبي بالتمهيد الحسابي وقيود اليومية والقوائم المالية.
2. 📷 قراءة وفحص صور التمارين والمستندات وحلها خطوة بخطوة بالحل النموذجي.
3. 💡 إجابة أسئلة التفسير بمنهجية الوزارة المعتمدة JRE [الحكم + التفسير + الدليل].

تفضل بكتابة سؤالك أو إرفاق صورة المسألة فوراً لنبدأ الحل! ✍️`;
  }

  if (/^(مرحبا|مرحباً|أهلا|اهلا|أهلاً|أهلا وسهلا|اهلا وسهلا|هاي|هلو|hello|hi)$/i.test(clean)) {
    return `أهلاً ومرحباً بك يا عبقري المحاسبة! 🌟
معك «البوب» مدرس المحاسبة المالية للصف الثاني الثانوي (2026).
أنا تحت أمرك في أي تمرين، قيد يومية، حسابات ختامية، أو سؤال في منهجك.
اطرح سؤالك أو أرسل صورة التمرين وسأجيبك فوراً بالحل والخطوات الدقيقة! 📚`;
  }

  if (/^(صباح الخير|صباح النور|مساء الخير|مساء النور)$/i.test(clean)) {
    return `يسعد أوقاتك بكل خير وتوفيق يا صديقي! ☀️
معك «البوب» أستاذ مادة المحاسبة المالية.
جاهز لكل أسئلتك وتمارينك المقررة.
اكتب مسألتك أو ارفع صورتها لنحلها بالخطوات الرياضية الدقيقة الآن! 💼`;
  }

  if (/^(ازيك|ازيك يا بوب|إزيك|إزيك يا بوب|ازيك يا مستر|عامل ايه|أخبارك|اخبارك|كيف حالك)$/i.test(clean)) {
    return `الحمد لله بأفضل حال وفي قمة النشاط! تسلم على ذوقك يا غالي. 🌟
أنا في كامل الجاهزية لنحل معاً أي مسألة في مادة المحاسبة المالية للصف الثاني الثانوي.
ما هو التمرين أو النقطة التي تحب أن نبدأ بها الآن؟ 📊`;
  }

  if (/^(من أنت|مين انت|عرف نفسك|مين البوب|من انت يا بوب|أنت مين|انت مين|تعريف)$/i.test(clean)) {
    return `أنا «البوب» - معلم ومساعد المحاسبة المالية الذكي الحصري لطلاب الصف الثاني الثانوي التجاري (البكالوريا المصرية 2026). 📘

أعتمد بنسبة 100% وبشكل حصري على:
• كتاب الوزارة الرسمي (الجزء الأول + الجزء الثاني).
• نماذج الإجابات الرسمية والتدريبات بنظام JRE [الحكم + التفسير + الدليل].

أقدم لك:
1. حل المسائل الرياضية بالتمهيد الحسابي وقيود اليومية ودفاتر الأستاذ والحسابات الختامية.
2. فحص صور الكتب والمذكرات والمستندات وحلها فورياً.

تفضل بإرسال أي مسألة أو سؤال وسأبدأ الحل معك فوراً! 🚀`;
  }

  if (/^(شكرا|شكراً|تسلم|تسلم يا بوب|شكرا يا بوب|الله ينور|جزاك الله خير|جزاك الله خيرا|الف شكر)$/i.test(clean)) {
    return `العفو يا غالي، ده واجبي ويسعدني دائماً تفوقك ونجاحك! 👏❤️
هدفي أن تكون الأول في المحاسبة المالية وتحصل على الدرجة النهائية بإذن الله.
إذا كان لديك أي تمرين أو استفسار إضافي، أنا في خدمتك دائماً! ✨`;
  }

  return null;
}

export default function App() {
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
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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

    // Fast local greeting response (0ms latency, zero quota usage, zero network errors)
    if (!attachment && text.trim()) {
      const localReply = matchLocalGreeting(text.trim());
      if (localReply) {
        const modelMsg: Message = {
          id: `mod-${Date.now() + 1}`,
          role: 'model',
          content: localReply,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages([...currentList, userMsg, modelMsg]);
        return;
      }
    }

    const modelMsgId = `mod-${Date.now() + 1}`;
    const initialModelMsg: Message = {
      id: modelMsgId,
      role: 'model',
      content: attachment
        ? 'جاري فحص المستند/الصورة وحل المسألة بالخطوات النموذجية...'
        : 'جاري مراجعة المسألة وفق كتاب الوزارة وصياغة الحل النموذجي...',
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

      // Retry loop with backoff for rock-solid stability
      let response: Response | null = null;
      let lastErrorMessage = '';
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatPayload }),
            signal: abortController.signal,
          });

          if (response.ok) {
            break;
          }

          if (response.status === 429) {
            lastErrorMessage = 'تم بلوغ الحد المؤقت للطلبات في الدقيقة (429). انتظر ثوانٍ واضغط إعادة المحاولة.';
            if (attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, 2000 * attempt));
              continue;
            }
          } else if (response.status === 500 || response.status === 503) {
            const errData = await response.json().catch(() => ({}));
            lastErrorMessage = errData.error || `خطأ في الخادم (${response.status})`;
            if (attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, 1500 * attempt));
              continue;
            }
          } else {
            const errData = await response.json().catch(() => ({}));
            lastErrorMessage = errData.error || `خطأ (${response.status})`;
            break;
          }
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') throw fetchErr;
          lastErrorMessage = 'انقطاع مؤقت في الاتصال بالخادم';
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }
        }
      }

      if (!response || !response.ok) {
        throw new Error(lastErrorMessage || 'تعذر الاتصال بالخادم');
      }

      const data = await response.json();
      if (data && data.text) {
        setMessages((prev) =>
          prev.map((m) => (m.id === modelMsgId ? { ...m, content: data.text } : m))
        );
      } else {
        throw new Error('لم يتم استلام نص الإجابة من الخادم');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Chat error:', error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsgId
              ? {
                  ...m,
                  content: `⚠️ تعذر استلام الإجابة: ${error.message || 'خطأ في الاتصال'}\n\nيمكنك النقر على زر إعادة المحاولة أدناه لمتابعة الشرح والحل فوراً.`,
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
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === prev.length - 1 && m.role === 'model' && m.content.startsWith('جاري')
            ? { ...m, content: 'تم إيقاف المعالجة بطلبك.' }
            : m
        )
      );
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
      />

      <main className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto p-4 sm:p-5 space-y-3">
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          return (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={isLast && isLoading && message.role === 'model'}
              onRetry={isLast ? handleRetryLast : undefined}
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
    </div>
  );
}
