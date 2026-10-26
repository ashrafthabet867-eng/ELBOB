import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const SYSTEM_INSTRUCTION = `أنت تطبيق "البوب" - المساعد الذكي لمادة المحاسبة المالية (الصف الثاني - البكالوريا المصرية).
أنت مقيّد حصرياً بالمنهج المصري والملفات المعتمدة (الجزء الأول: الوحدات 1-5، والجزء الثاني: الوحدات 6-10).

قواعد الإجابة النموذجية الفورية (JRE - التفسير المدعوم بالأدلة):
1. ابدأ بالإجابة المباشرة فوراً بدون أي مقدمات أو تكرار لنص السؤال.
2. في الأسئلة المباشرة والمراجعة وفقرة (فكّر):
   - أجب بصيغة [حكم + تفسير] موجزة ودقيقة في 2-4 أسطر باستخدام أدوات الربط: (لأن... لذلك... وهذا يعني أن...).
3. في التمارين والعمليات الحسابية والصور/الملفات:
   - استخرج الأرقام فوراً، وقدّم التمهيد الرياضي، وقيود اليومية منسقة (من حـ/ ... إلى حـ/ ...)، وحسابات T والقوائم المالية بدقة تامة.
4. استخدم لغة عربية فصحى ومصطلحات المحاسبة المعتمدة في المنهج المصري.`;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'مفتاح GEMINI_API_KEY غير موجود في إعدادات Vercel. يرجى إضافته في إعدادات المشروع على Vercel: Settings > Environment Variables ثم عمل Redeploy.',
    });
  }

  try {
    const { messages } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'قائمة الرسائل مطلوبة' });
    }

    // Filter out error messages and empty entries
    const validMessages = messages.filter(
      (m: any) =>
        m &&
        ((m.content && m.content.trim() !== '') || m.attachment?.data) &&
        !m.content?.startsWith('⚠️') &&
        !m.content?.includes('تعذر استلام') &&
        !m.content?.includes('عذراً')
    );

    const firstUserIndex = validMessages.findIndex((m: { role: string }) => m.role === 'user');
    const userStartedMessages = firstUserIndex !== -1 ? validMessages.slice(firstUserIndex) : validMessages;

    if (userStartedMessages.length === 0) {
      return res.status(400).json({ error: 'يجب أن تبدأ المحادثة برسالة من المستخدم' });
    }

    // Convert messages to Gemini contents supporting multimodality
    const contents: Array<{ role: 'user' | 'model'; parts: Array<any> }> = [];
    for (const msg of userStartedMessages) {
      const role: 'user' | 'model' =
        msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user';

      const parts: any[] = [];

      if (role === 'user' && msg.attachment?.data) {
        parts.push({
          inlineData: {
            mimeType: msg.attachment.mimeType || 'image/jpeg',
            data: msg.attachment.data,
          },
        });
      }

      const textContent =
        msg.content ||
        (msg.attachment
          ? 'يرجى حل وشرح المسألة المحاسبية من المرفق حلاً نموذجياً دقيقاً.'
          : '');

      if (textContent) {
        parts.push({ text: textContent });
      }

      if (parts.length > 0) {
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts.push(...parts);
        } else {
          contents.push({ role, parts });
        }
      }
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    // Lightning-fast model with MINIMAL thinking for sub-second responses
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let replyText = '';
    let lastError = '';

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.2,
            maxOutputTokens: 800,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
          },
        });

        if (response.text) {
          replyText = response.text.trim();
          break;
        }
      } catch (err: any) {
        lastError = err.message || String(err);
        console.warn(`Model ${modelName} error on Vercel:`, lastError);
      }
    }

    if (!replyText) {
      return res.status(503).json({
        error: `تعذر الاتصال بالذكاء الاصطناعي: ${lastError}`,
      });
    }

    return res.status(200).json({ text: replyText });
  } catch (error: any) {
    console.error('Vercel chat error:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ في السيرفر' });
  }
}
