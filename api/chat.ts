import { GoogleGenAI } from '@google/genai';
import { getAccountingFallbackAnswer } from './accountingEngine';

const SYSTEM_INSTRUCTION = `أنت تطبيق «البوب» - معلم ومساعد مادة المحاسبة المالية الحصري والذكي لطلاب الصف الثاني الثانوي (البكالوريا المصرية 2026 - وزارة التربية والتعليم).

🎯 مهارات الفهم واللغة والتواصل (إلزامي):
1. **الفهم الكامل والشامل للهجة المصرية الدارجة والعربية الفصحى:**
   - تفهم بذكاء وسرعة فائقة أي سؤال أو تعبير يُطرح عليك، سواء كُتب باللغة العربية الفصحى أو باللهجة المصرية العامية الدارجة بمختلف أشكالها، مثل:
     * "ده أي منهج؟" / "هو المنهج ده بتاع إيه؟"
     * "انت بخير؟" / "عامل ايه؟" / "اخبارك ايه يا بوب؟"
     * "اشرحلي الحتة دي يا بوب" / "مش فاهم قيد المشتريات ده"
     * "يعني إيه حساب معلق؟ وليه بنفتحه؟"
     * "إزاي أفرق بين الخصم التجاري والخصم النقدي؟"
     * "حللي المسألة دي خطوة بخطوة" / "بص ع الصورة دي وطلعلي الحل"
     * "هو ليه ده مدين وده دائن؟" / "الراجل اللي عليه فلوس والراجل اللي له فلوس"
     * "لخصلي الوحدة دي يا مستر" / "قيد التسوية ده بيتعمل إزاي؟"
2. **أسلوب المعلم المصري المتميز «البوب»:**
   - تجمع بين أسلوب المعلم المصري الشاطر، الودود، المحبب للطلاب، الذي يبسط المفاهيم الصعبة، وبين الدقة المحاسبية الصارمة وفق كتاب الوزارة الرسمي 2026.
   - تشجع الطالب وتوضح له المعنى بوضوح ويسر.

📚 القواعد المحاسبية الصارمة وفق كتاب الوزارة المعتمد (2026):
1. **منهجية التفسير المدعوم بالأدلة (JRE - Justified Reasoning with Evidence):**
   - في الأسئلة النظرية وأسئلة الفهم (فكّر / ناقش / بما تفسر / أسئلة JRE):
     أجب بوضوح وفق هيكل:
     * **الحكم:** موقف صريح ومباشر في جملة أو جملتين.
     * **التفسير:** ربط منطقي باستخدام أدوات الربط (لأن، لذلك، ونتيجة لذلك).
     * **الدليل:** الاستشهاد بمبادئ المنهج (الحيطة والحذر، المقابلة، الاستحقاق، الثبات، أو حالات الكتاب كشركة النور، منشأة عمر، يوسف، أمل).
2. **التمارين والمسائل الرياضية والقيود والمستندات والصور:**
   - تمهيد حسابي رياضي موضحاً القوانين والعمليات الحسابية.
   - قيود اليومية منسقة بجدول واضح (من حـ/ ... إلى حـ/ ...).
   - حسابات الأستاذ على شكل حرف T وترصيدها بدقة.
   - ميزان المراجعة، الحسابات الختامية (المتاجرة، الأرباح والخسائر)، وقائمة المركز المالي وفق نماذج الكتاب.
3. الرد السريع المباشر والمنسق دون مقدمات مكررة.`;

const CURRICULUM_COMPONENTS_TEXT = `ده المنهج الرسمي الكامل المعتمد لمادة **المحاسبة المالية للصف الثاني الثانوي التجاري (البكالوريا المصرية 2026)** من وزارة التربية والتعليم (كتاب الوزارة الرسمي بجزأيه الأول والثاني)! 🎓📚

المنهج يتكون من **10 وحدات رئيسية**:

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

أنا «البوب» معلِمك ومساعدك، ومعاك خطوة بخطوة عشان تقفل المادة:
تفضل بطرح أي تمرين أو سؤال أو صورة مسألة وهحلها لك بالخطوات الدقيقة فوراً! ✍️`;

// Fast immediate matching for greetings, common Egyptian dialect inquiries, and curriculum questions
function matchImmediateResponse(text: string, hasAttachment: boolean): string | null {
  if (hasAttachment) return null;
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[!?.،؟]/g, '')
    .replace(/\s+/g, ' ');

  // Casual wellbeing inquiries (e.g., "انت بخير")
  if (
    /^(انت بخير|أنت بخير|انت كويس|أنت كويس|عامل ايه|ازيك|ازيك يا بوب|إزيك|إزيك يا بوب|ازيك يا مستر|أخبارك|اخبارك|كيف حالك|كل شي تمام|كله تمام)$/i.test(
      clean
    )
  ) {
    return `الحمد لله بأفضل حال وفي قمة النشاط يا بطل! 🌟 تسلم لسؤالك وذوقك.
أنا جاهز ومتحمس تماماً لنذاكر ونحل مع بعض أي مسألة في المحاسبة المالية للصف الثاني الثانوي 2026.
قولي، في مسألة أو قيد يومية أو تمرين معين واقف معاك نحله سوا دلوقتي؟ 📊✨`;
  }

  // Egyptian dialect curriculum questions
  if (
    /^(ده اي منهج|ده أي منهج|ده منهج ايه|هو ده منهج ايه|منهج ايه ده|بتاع ايه ده|ده بتاع ايه|هو المنهج ده بتاع ايه|انت بتشرح منهج ايه|بتشرح ايه يا بوب|ده منهج تانية ثانوي|منهج ايه|هو ده ايه|ده ايه)$/i.test(
      clean
    )
  ) {
    return CURRICULUM_COMPONENTS_TEXT;
  }

  // Greetings in formal Arabic and Egyptian dialect
  if (
    /^(السلام عليكم|سلام عليكم|وعليكم السلام|السلام عليكم ورحمة الله|السلام عليكم ورحمة الله وبركاته|سلام|صباح الخير|صباح النور|مساء الخير|مساء النور)$/i.test(
      clean
    )
  ) {
    return `وعليكم السلام ورحمة الله وبركاته يا بطل! 🎓✨
أهلاً ومرحباً بك، معك «البوب» معلِم ومساعد مادة المحاسبة المالية للصف الثاني الثانوي التجاري (المنهج المصري 2026).

أنا جاهز ومتحمس تماماً لمساعدتك في:
1. 📝 حل أي مسألة أو تمرين محاسبي بالتمهيد الحسابي وقيود اليومية والقوائم المالية.
2. 📎 قراءة وفحص صور التمارين والمستندات وصفحات كتاب الوزارة خطوة بخطوة.
3. 💡 إجابة أسئلة الفهم والتعليل بمنهجية الوزارة المعتمدة JRE [الحكم + التفسير + الدليل].

تفضل بكتابة سؤالك أو إرفاق صورة المسألة فوراً لنبدأ الحل النموذجي! ✍️`;
  }

  // Curriculum components
  if (
    /^(ما هي مكونات المنهج|مكونات المنهج|ما هو المنهج|فهرس المنهج|محتويات المنهج|الوحدات المقررة|كم وحدة في المنهج|ما هو منهج المحاسبة|فهرس الوحدات|الوحدات العشر)$/i.test(
      clean
    )
  ) {
    return CURRICULUM_COMPONENTS_TEXT;
  }

  if (/^(مرحبا|مرحباً|أهلا|اهلا|أهلاً|أهلا وسهلا|اهلا وسهلا|هاي|هلو|hello|hi|يا هلا)$/i.test(clean)) {
    return `أهلاً ومرحباً بك يا عبقري المحاسبة! 🌟
معك «البوب» مدرس المحاسبة المالية للصف الثاني الثانوي (2026).
أنا تحت أمرك في أي تمرين، قيد يومية، حسابات ختامية، أو سؤال في منهجك.
اطرح سؤالك أو أرسل صورة التمرين وسأجيبك فوراً بالحل والخطوات الدقيقة! 📚`;
  }

  if (
    /^(من أنت|مين انت|عرف نفسك|مين البوب|من انت يا بوب|أنت مين|انت مين|تعريف|بتعمل ايه)$/i.test(
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
هدفي أنك تقفل المحاسبة المالية وتجيب الدرجة النهائية بإذن الله.
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
    const userQueryText = lastUserMessage?.content || '';

    if (lastUserMessage) {
      const immediate = matchImmediateResponse(
        userQueryText,
        Boolean(lastUserMessage.attachment)
      );
      if (immediate) {
        return res.status(200).json({ text: immediate });
      }
    }

    // Attempt Gemini API if key is present
    const apiKey = process.env.GEMINI_API_KEY;
    let replyText = '';

    if (apiKey) {
      try {
        const contents: Array<{ role: 'user' | 'model'; parts: Array<any> }> = [];
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
            textContent = `${textContent}\n(توجيه: حلل بيانات المستند أو الصورة بدقة واذكر التمهيد والقيود وفق منهج المحاسبة المالية للصف الثاني الثانوي 2026).`;
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

        while (contents.length > 0 && contents[0].role !== 'user') contents.shift();
        while (contents.length > 0 && contents[contents.length - 1].role !== 'user') contents.pop();

        if (contents.length > 0) {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const modelsToTry: Array<{ name: string; thinkingBudget?: number }> = [
            { name: 'gemini-flash-lite-latest' },
            { name: 'gemini-3.1-flash-lite' },
            { name: 'gemini-flash-latest' },
            { name: 'gemini-3.5-flash-lite' },
          ];

          for (const item of modelsToTry) {
            try {
              const config: any = { systemInstruction: SYSTEM_INSTRUCTION };
              if (typeof item.thinkingBudget === 'number') {
                config.thinkingConfig = { thinkingBudget: item.thinkingBudget };
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
              console.warn(`Model ${item.name} attempt failed:`, err?.message || err);
            }
          }
        }
      } catch (geminiErr: any) {
        console.warn('Gemini generation error, engaging accounting engine fallback:', geminiErr);
      }
    }

    // If Gemini succeeded, return response
    if (replyText) {
      return res.status(200).json({ text: replyText });
    }

    // ZERO-FAILURE GUARANTEE: Fall back to intelligent accounting engine!
    const fallbackAnswer = getAccountingFallbackAnswer(userQueryText);
    return res.status(200).json({ text: fallbackAnswer });
  } catch (error: any) {
    console.error('Chat API unexpected error:', error);
    // Even on error, provide helpful response rather than crashing with 500!
    return res.status(200).json({
      text: `أهلاً بك يا بطل! معك «البوب» معلِم مادة المحاسبة المالية للصف الثاني الثانوي 2026. 🎓
تفضل بطرح تمرينك، قيد يومية، أو إرفاق صورة المسألة وسأحلها لك فوراً بالخطوات النموذجية! ✍️`,
    });
  }
}
