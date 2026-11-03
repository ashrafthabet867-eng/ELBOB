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
      error: 'مفتاح GEMINI_API_KEY غير متوفر في إعدادات الخادم.',
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
        !m.content?.includes('جاري فحص المسألة') &&
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
        let cleanData = msg.attachment.data;
        if (typeof cleanData === 'string' && cleanData.includes(',')) {
          cleanData = cleanData.split(',')[1];
        }
        parts.push({
          inlineData: {
            mimeType: msg.attachment.mimeType || 'image/jpeg',
            data: cleanData,
          },
        });
      }

      let textContent = msg.content || '';
      if (!textContent && msg.attachment) {
        textContent = 'يرجى حل وشرح المسألة المحاسبية المرفقة خطوة بخطوة بالتمهيد الحسابي وقيود اليومية والقوائم المالية حلاً نموذجياً دقيقاً.';
      } else if (textContent && msg.attachment) {
        textContent = `${textContent}\n(توجيه للمساعد: حلل بيانات الصورة أو المستند المحاسبي بدقة تامة واذكر التمهيد الحسابي والقيود والحسابات وفق منهج الصف الثاني الثانوي التجاري 2026).`;
      }

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

    // Ensure conversation starts and ends with user message for strict API compliance
    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift();
    }
    while (contents.length > 0 && contents[contents.length - 1].role !== 'user') {
      contents.pop();
    }

    if (contents.length === 0) {
      return res.status(400).json({ error: 'يجب أن تبدأ المحادثة برسالة من المستخدم' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    // High-performance models with proven active capacity & fallback
    const modelsToTry: Array<{ name: string; thinkingLevel?: ThinkingLevel }> = [
      { name: 'gemini-3.6-flash' },
      { name: 'gemini-3.5-flash' },
      { name: 'gemini-flash-lite-latest' },
      { name: 'gemini-3.5-flash-lite' },
      { name: 'gemini-3.8-flash' },
    ];
    let replyText = '';
    const modelErrors: string[] = [];

    for (const item of modelsToTry) {
      try {
        const config: any = {
          systemInstruction: SYSTEM_INSTRUCTION,
        };
        if (item.thinkingLevel) {
          config.thinkingConfig = {
            thinkingLevel: item.thinkingLevel,
          };
        }

        const response = await ai.models.generateContent({
          model: item.name,
          contents,
          config,
        });

        if (response.text) {
          replyText = response.text.trim();
          break;
        }
      } catch (err: any) {
        const msg = err.message || String(err);
        modelErrors.push(`${item.name}: ${msg}`);
        console.warn(`Model ${item.name} error:`, msg);
      }
    }

    if (!replyText) {
      return res.status(503).json({
        error: `تعذر الاتصال بالذكاء الاصطناعي: ${modelErrors.join(' || ')}`,
      });
    }

    return res.status(200).json({ text: replyText });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ في السيرفر' });
  }
}
