import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const SYSTEM_INSTRUCTION = `أنت تطبيق "البوب" - المساعد الذكي لمادة المحاسبة المالية (الصف الثاني - البكالوريا المصرية).
أنت مقيّد حصرياً بالمنهج المصري والملفات المعتمدة (الجزء الأول: الوحدات 1-5، والجزء الثاني: الوحدات 6-10).

قواعد الإجابة النموذجية المعتمدة (JRE - التفسير المدعوم بالأدلة):
1. في الأسئلة المباشرة والمراجعة وفقرة (فكّر):
   - أجب بصيغة [حكم + تفسير] موجزة ومباشرة من 1-3 جمل باستخدام أدوات الربط: (لأن... لذلك... وهذا يعني أن...).
2. في أسئلة JRE التحليلية الكبرى:
   - اتبع الهيكل المعتمد: [مقدمة تحدد المفهوم والموقف -> الحجة الأولى -> الحجة الثانية أو المضادة والرد عليها -> خاتمة بحكم مبرر متوازن].
3. في التمارين والعمليات الحسابية:
   - قدّم التمهيد الحسابي الرياضي بدقة.
   - قيود اليومية منسقة بدقة: من حـ/ ... إلى حـ/ ... مع المبالغ والشرح.
   - حسابات الأستاذ حرف T والترصيد، وميزان المراجعة، ومذكرة تسوية البنك، والقوائم المالية (المتاجرة، أ.خ، المركز المالي) بدقة تامة.
4. الأسلوب:
   - ابدأ بالحل مباشرة بدون مقدمات فارغة أو تكرار لنص السؤال.
   - لغة عربية فصحى واضحة وعبارات محاسبية معتمدة في المنهج المصري.`;

export default async function handler(req: any, res: any) {
  // CORS Headers for Vercel
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
      (m: { role: string; content?: string }) =>
        m &&
        m.content &&
        m.content.trim() !== '' &&
        !m.content.startsWith('⚠️') &&
        !m.content.includes('تعذر استلام') &&
        !m.content.includes('عذراً')
    );

    const firstUserIndex = validMessages.findIndex((m: { role: string }) => m.role === 'user');
    const userStartedMessages = firstUserIndex !== -1 ? validMessages.slice(firstUserIndex) : validMessages;

    if (userStartedMessages.length === 0) {
      return res.status(400).json({ error: 'يجب أن تبدأ المحادثة برسالة من المستخدم' });
    }

    // Merge consecutive turns with the same role
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const msg of userStartedMessages) {
      const role: 'user' | 'model' =
        msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user';

      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + msg.content;
      } else {
        contents.push({
          role,
          parts: [{ text: msg.content }],
        });
      }
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

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
            temperature: 0.1,
            ...(modelName.includes('3.8')
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
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
