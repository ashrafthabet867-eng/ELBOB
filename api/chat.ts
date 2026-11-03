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
${CURRICULUM_KNOWLEDGE_BASE}`;

// Fast in-memory responses for common greetings to prevent hitting Free-Tier API Rate Limits
function matchImmediateResponse(text: string, hasAttachment: boolean): string | null {
  if (hasAttachment) return null;
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[!?.،؟]/g, '')
    .replace(/\s+/g, ' ');

  if (
    /^(السلام عليكم|سلام عليكم|وعليكم السلام|السلام عليكم ورحمة الله|السلام عليكم ورحمة الله وبركاته|سلام)$/i.test(
      clean
    )
  ) {
    return `وعليكم السلام ورحمة الله وبركاته يا بطل! 🎓✨
أهلاً ومرحباً بك، معك «البوب» معلم ومساعد مادة المحاسبة المالية للصف الثاني الثانوي التجاري (المنهج المصري 2026).

أنا جاهز ومتحمس تماماً لمساعدتك في:
1. 📝 حل أي مسألة أو تمرين محاسبي بالتمهيد الحسابي وقيود اليومية والقوائم المالية.
2. 📷 قراءة وفحص صور التمارين والمستندات وحلها خطوة بخطوة بالحل النموذجي.
3. 💡 إجابة أسئلة التفسير بمنهجية الوزارة JRE [الحكم + التفسير + الدليل].
4. 🔊 الاستماع للشرح الصوتي لكل مسألة بوضوح.

تفضل بكتابة سؤالك أو إرفاق صورة المسألة فوراً لنبدأ الحل! ✍️`;
  }

  if (/^(مرحبا|مرحباً|أهلا|اهلا|أهلاً|أهلا وسهلا|اهلا وسهلا|هاي|هلو|hello|hi)$/i.test(clean)) {
    return `أهلاً ومرحباً بك يا عبقري المحاسبة! 🌟
معك «البوب» مدرس المحاسبة المالية للصف الثاني الثانوي (2026).
أنا تحت أمرك في أي تمرين، قيد يومية، حسابات ختامية، أو سؤال في منهجك.
اطرح سؤالك أو أرسل صورة التمرين من كتابك وسأجيبك فوراً بالخطوات والشرح الصوتي! 📚`;
  }

  if (/^(صباح الخير|صباح النور|مساء الخير|مساء النور)$/i.test(clean)) {
    return `يسعد أوقاتك بكل خير وتوفيق يا صديقي! ☀️
معك «البوب» أستاذ مادة المحاسبة المالية.
جاهز لكل أسئلتك وتمارينك في منهج الصف الثاني الثانوي.
اكتب مسألتك أو ارفع صورتها لنحلها بالخطوات الرياضية الدقيقة الآن! 💼`;
  }

  if (/^(ازيك|ازيك يا بوب|إزيك|إزيك يا بوب|ازيك يا مستر|عامل ايه|أخبارك|اخبارك|كيف حالك)$/i.test(clean)) {
    return `الحمد لله بأفضل حال وفي قمة النشاط! تسلم على ذوقك يا غالي. 🌟
أنا في كامل الجاهزية لنحل معاً أي مسألة في مادة المحاسبة المالية للصف الثاني الثانوي.
ما هو التمرين أو النقطة التي تريد أن نبدأ بها الآن؟ 📊`;
  }

  if (
    /^(من أنت|مين انت|عرف نفسك|مين البوب|من انت يا بوب|أنت مين|انت مين|تعريف)$/i.test(
      clean
    )
  ) {
    return `أنا «البوب» - معلم ومساعد المحاسبة المالية الذكي الحصري لطلاب الصف الثاني الثانوي التجاري (البكالوريا المصرية 2026). 📘

أعتمد بنسبة 100% وبشكل حصري على:
• كتاب الوزارة الرسمي (الجزء الأول + الجزء الثاني).
• نماذج الإجابات الرسمية والتدريبات بنظام JRE [الحكم + التفسير + الدليل].

أقدم لك:
1. حل المسائل الرياضية بالتمهيد الحسابي وقيود اليومية ودفاتر الأستاذ والحسابات الختامية.
2. فحص صور الكتب والمذكرات والمستندات وحلها فورياً.
3. شرح صوتي مسموع بالضغط على زر «استمع للشرح».

تفضل بإرسال أي مسألة أو سؤال وسأبدأ الحل معك فوراً! 🚀`;
  }

  if (
    /^(شكرا|شكراً|تسلم|تسلم يا بوب|شكرا يا بوب|الله ينور|جزاك الله خير|جزاك الله خيرا|الف شكر)$/i.test(
      clean
    )
  ) {
    return `العفو يا غالي، ده واجبي ويسعدني دائماً تفوقك ونجاحك! 👏❤️
هدفي أن تكون الأول في المحاسبة المالية وتحصل على الدرجة النهائية بإذن الله.
إذا كان لديك أي تمرين أو استفسار إضافي، أنا في خدمتك دائماً! ✨`;
  }

  return null;
}

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

    // Check last user message for fast greetings / pleasantries to preserve API quotas
    const lastUserMessage = [...userStartedMessages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      const immediate = matchImmediateResponse(
        lastUserMessage.content || '',
        Boolean(lastUserMessage.attachment)
      );
      if (immediate) {
        return res.status(200).json({ text: immediate });
      }
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

    // High-performance models with active capacity & fallback
    const modelsToTry: Array<{ name: string; thinkingLevel?: ThinkingLevel }> = [
      { name: 'gemini-3.6-flash' },
      { name: 'gemini-3.5-flash' },
      { name: 'gemini-flash-lite-latest' },
      { name: 'gemini-3.5-flash-lite' },
    ];

    let replyText = '';
    const modelErrors: string[] = [];
    let hadRateLimit = false;

    for (let i = 0; i < modelsToTry.length; i++) {
      const item = modelsToTry[i];
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

        if (
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('quota') ||
          msg.includes('Rate limit')
        ) {
          hadRateLimit = true;
          // Apply exponential backoff before trying next fallback model
          if (i < modelsToTry.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      }
    }

    if (!replyText) {
      if (hadRateLimit) {
        return res.status(429).json({
          error: 'تم بلوغ الحد المؤقت لطلبات الدقيقة (429). يُرجى الانتظار بضع ثوانٍ فقط ثم الضغط على زر إعادة المحاولة.',
        });
      }
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
