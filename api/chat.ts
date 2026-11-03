import { GoogleGenAI } from '@google/genai';
import { CURRICULUM_KNOWLEDGE_BASE } from './curriculumData';

const SYSTEM_INSTRUCTION = `أنت تطبيق «البوب» - معلم ومساعد المحاسبة المالية الحصري لطلاب الصف الثاني الثانوي (البكالوريا المصرية 2026).
أنت مقيّد حصرياً وبالكامل بالمحتوى الوارد في كتاب الوزارة الرسمي بجزأيه الأول والثاني ونماذج إجابات JRE الرسمية.

قواعد الرد الإلزامية:
1. الالتزام بمنهجية الوزارة (JRE - Justified Reasoning with Evidence):
   - في الأسئلة النظرية أو التفسيرية (فكّر / ناقش / بما تفسر):
     أجب بوضوح وفق هيكل:
     * الحكم (Claim / Judgment): موقف صريح ومباشر في جملة أو جملتين دون عبارات تردد.
     * التفسير (Reasoning): ربط منطقي بأدوات الربط (لأن، لذلك، ونتيجة لذلك).
     * الدليل (Evidence): الاستشهاد الصريح بمبادئ المنهج (الحيطة والحذر، المقابلة، الاستحقاق، الثبات، أو حالات الكتاب كمنشأة عمر، يوسف، حسن، شركة النور، أمل).
2. في التمارين والمسائل الرياضية والقيود والمستندات والصور:
   - قم بالحل المباشر الكامل متضمناً:
     * التمهيد الحسابي الرياضي والقوانين.
     * قيود اليومية منسقة بوضوح (من حـ/ ... إلى حـ/ ...).
     * حسابات الأستاذ على شكل حرف T وترصيدها.
     * ميزان المراجعة والحسابات الختامية (المتاجرة، الأرباح والخسائر) وقائمة المركز المالي.
3. التزام دقيق بالمصطلحات المعتمدة:
   (دفاتر اليومية المساعدة، دفتر النقدية ذو الـ3 أعمدة، الحساب المعلق، إشعار مدين ودائن، الخصم التجاري والخصم النقدي، القسط الثابت والمتناقص، حسابات المراقبة، مذكرة تسوية البنك، الشهرة، نسب السيولة والربحية).
4. الرد المباشر السريع المركز دون إطالة إنشائية أو مقدمات مكررة.

قاعدة المعرفة المعتمدة من كتاب الوزارة:
${CURRICULUM_KNOWLEDGE_BASE}`;

const CURRICULUM_COMPONENTS_TEXT = `يتكون منهج المحاسبة المالية للصف الثاني الثانوي (البكالوريا المصرية 2026) حصرياً من **10 وحدات رئيسية** موزعة على جزأين:

📘 **الجزء الأول: المفاهيم والعمليات المالية الأساسية**
1. **الوحدة الأولى: لماذا نتعلم المحاسبة؟** (أهداف المحاسبة، مستخدمو المعلومات، المبادئ المحاسبية: الحيطة والحذر والمقابلة والثبات، أساس الاستحقاق والأساس النقدي).
2. **الوحدة الثانية: قاعدة القيد المزدوج وحسابات دفاتر الأستاذ** (قواعد المدين والدائن للوكا باتشولي، دفتر الأستاذ T-Account، ميزان المراجعة، الأخطاء المحاسبية، وحساب التسوية المعلق Suspense Account).
3. **الوحدة الثالثة: دفاتر اليومية المساعدة (Books of Prime Entry)** (دفتر يومية المبيعات الآجلة والمشتريات الآجلة ومردوداتها، ودفتر النقدية ذو الثلاثة أعمدة).
4. **الوحدة الرابعة: ميزان المراجعة وتصحيح الأخطاء** (الأخطاء التي تمنع التوازن والأخطاء التي لا تمنع التوازن وطرق تصحيحها).
5. **الوحدة الخامسة: القوائم المالية – المنشأة الفردية** (حساب المتاجرة، حساب الأرباح والخسائر، قائمة التغير في حقوق الملكية، وقائمة المركز المالي).

📗 **الجزء الثاني: العمليات المحاسبية المتقدمة والشركات**
6. **الوحدة السادسة: السجلات غير المكتملة ونظم الرقابة المحاسبية** (معالجة السجلات الناقصة، ومذكرة تسوية البنك Bank Reconciliation).
7. **الوحدة السابعة: الإهلاك والمخصصات واستبعاد الأصول** (طرق الإهلاك: القسط الثابت والقسط المتناقص، مخصص الديون المشكوك فيها، ومخصص هبوط أسعار بضاعة).
8. **الوحدة الثامنة: حسابات الشراكة (Partnership Accounts)** (عقد الشركة، توزيع الأرباح والخسائر، انضمام أو انفصال شريك، إعادة التقدير، والشهرة).
9. **الوحدة التاسعة: الشركات ذات المسؤولية المحدودة والمنظمات غير الهادفة للربح** (الأسهم والسندات، وحساب المقبوضات والمدفوعات).
10. **الوحدة العاشرة: تحليل القوائم المالية وتفسيرها** (نسب السيولة والتداول، نسب الربحية، نسب الكفاءة، وتطبيق منهجية التفسير المدعوم بالأدلة JRE).

تفضل بطرح أي تمرين أو مسألة في أي وحدة وسأحلها لك فوراً بالخطوات الدقيقة! ✍️`;

// Fast matching for greetings and curriculum inquiries to guarantee 0ms latency
function matchImmediateResponse(text: string, hasAttachment: boolean): string | null {
  if (hasAttachment) return null;
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[!?.،؟]/g, '')
    .replace(/\s+/g, ' ');

  // Greetings
  if (
    /^(السلام عليكم|سلام عليكم|وعليكم السلام|السلام عليكم ورحمة الله|السلام عليكم ورحمة الله وبركاته|سلام)$/i.test(
      clean
    )
  ) {
    return `وعليكم السلام ورحمة الله وبركاته يا بطل! 🎓✨
أهلاً ومرحباً بك، معك «البوب» معلم ومساعد مادة المحاسبة المالية للصف الثاني الثانوي التجاري (المنهج المصري 2026).

أنا جاهز ومتحمس تماماً لمساعدتك في:
1. 📝 حل أي مسألة أو تمرين محاسبي بالتمهيد الحسابي وقيود اليومية والقوائم المالية.
2. 📎 قراءة وفحص صور التمارين والمستندات وصفحات كتاب الوزارة خطوة بخطوة.
3. 💡 إجابة أسئلة التفسير والتعليل بمنهجية الوزارة المعتمدة JRE [الحكم + التفسير + الدليل].

تفضل بكتابة سؤالك أو إرفاق صورة المسألة فوراً لنبدأ الحل النموذجي! ✍️`;
  }

  // Curriculum overview
  if (
    /^(ما هي مكونات المنهج|مكونات المنهج|ما هو المنهج|فهرس المنهج|محتويات المنهج|الوحدات المقررة|كم وحدة في المنهج|ما هو منهج المحاسبة|فهرس الوحدات|الوحدات العشر)$/i.test(
      clean
    )
  ) {
    return CURRICULUM_COMPONENTS_TEXT;
  }

  if (/^(مرحبا|مرحباً|أهلا|اهلا|أهلاً|أهلا وسهلا|اهلا وسهلا|هاي|هلو|hello|hi)$/i.test(clean)) {
    return `أهلاً ومرحباً بك يا عبقري المحاسبة! 🌟
معك «البوب» مدرس المحاسبة المالية للصف الثاني الثانوي (2026).
أنا تحت أمرك في أي تمرين، قيد يومية، حسابات ختامية، أو سؤال في منهجك.
اطرح سؤالك أو أرسل صورة التمرين من كتابك وسأجيبك فوراً بالحل والخطوات الدقيقة! 📚`;
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
        !m.content?.includes('جاري مراجعة المسألة') &&
        !m.content?.includes('عذراً')
    );

    const firstUserIndex = validMessages.findIndex((m: { role: string }) => m.role === 'user');
    const userStartedMessages = firstUserIndex !== -1 ? validMessages.slice(firstUserIndex) : validMessages;

    if (userStartedMessages.length === 0) {
      return res.status(400).json({ error: 'يجب أن تبدأ المحادثة برسالة من المستخدم' });
    }

    // Check last user message for fast immediate matching
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

    // Keep only last 4 messages to prevent excessive token count and keep response times lightning-fast
    const recentMessages = userStartedMessages.slice(-4);

    for (const msg of recentMessages) {
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
        textContent = `${textContent}\n(توجيه: حلل بيانات المستند أو الصورة المحاسبية بدقة تامة واذكر التمهيد الحسابي والقيود وفق منهج الصف الثاني الثانوي 2026).`;
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

    // Ensure conversation starts and ends with user message
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

    // High-performance models prioritized for sub-3-second responses
    const modelsToTry: Array<{ name: string; thinkingBudget?: number }> = [
      { name: 'gemini-3.5-flash', thinkingBudget: 0 },
      { name: 'gemini-3.6-flash', thinkingBudget: 0 },
      { name: 'gemini-flash-latest' },
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

        if (typeof item.thinkingBudget === 'number') {
          config.thinkingConfig = {
            thinkingBudget: item.thinkingBudget,
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
          if (i < modelsToTry.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    if (!replyText) {
      if (hadRateLimit) {
        return res.status(429).json({
          error: 'تم بلوغ الحد المؤقت لطلبات الدقيقة (429). يُرجى الانتظار 3 ثوانٍ فقط ثم النقر على زر إعادة المحاولة.',
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
