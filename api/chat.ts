import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { CURRICULUM_KNOWLEDGE_BASE } from './curriculumData';

const SYSTEM_INSTRUCTION = `أنت تطبيق «البوب» - معلم ومساعد المحاسبة المالية الحصري للصف الثاني الثانوي (البكالوريا المصرية 2026).
أنت مقيّد حصرياً وبالكامل بالمحتوى الوارد في قاعدة المعرفة المعتمدة أدناه (كتاب الوزارة الرسمي بجزأيه الأول والثاني ونماذج إجابات JRE الرسمية). يمنع منعاً باتاً الخروج عن هذه الملفات أو استخدام مصطلحات أو قواعد محاسبية تخالفها.

قواعد الرد الإلزامية:
1. الالتزام بمنهجية الوزارة (JRE - Justified Reasoning with Evidence):
   - في الأسئلة النظرية أو التفسيرية أو أسئلة (فكّر / ناقش / بما تفسر / أسئلة JRE):
     أجب بوضوح وفق هيكل [الحكم + التفسير + الدليل]:
     * الحكم: موقف صريح ومباشر في جملة أو جملتين دون عبارات ضعيفة مثل (يعتمد الأمر...).
     * التفسير: ربط منطقي باستخدام أدوات الربط (لأن، لذلك، ونتيجة لذلك، وهذا يؤدي إلى).
     * الدليل: الاستشهاد الصريح بمبادئ المنهج (الحيطة والحذر، المقابلة، الاستحقاق، الثبات، أو حالات الكتاب كمنشأة عمر، يوسف، حسن، شركة النور، منشأة أمل).
2. في التمارين الرياضية والمسائل والقيود والصور والمستندات:
   - قم بالحل المباشر الكامل متضمناً:
     * التمهيد الحسابي الرياضي والقوانين المستخدمة.
     * قيود اليومية منسقة بوضوح (من حـ/ ... إلى حـ/ ...).
     * حسابات الأستاذ على شكل حرف T وترصيدها بدقة.
     * ميزان المراجعة، الحسابات الختامية (المتاجرة، الأرباح والخسائر)، وقائمة المركز المالي وفق نماذج الكتاب المقررة.
3. التزام دقيق بالمصطلحات المعتمدة في المنهج المصري:
   - (دفاتر اليومية المساعدة، دفتر النقدية ذو الثلاثة أعمدة، الحساب المعلق، إشعار مدين لمردودات المشتريات، إشعار دائن لمردودات المبيعات، الخصم التجاري والخصم النقدي، القسط الثابت والمتناقص، حسابات المراقبة، مذكرة تسوية البنك، الشهرة، نسب التداول والسيولة والربحية والكفاءة).
4. الرد المباشر السريع دون مقدمات إنشائية مكررة أو إعادة كتابة نص السؤال.

قاعدة المعرفة الحصرية المعتمدة من كتاب الوزارة:
${CURRICULUM_KNOWLEDGE_BASE}
`;

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
