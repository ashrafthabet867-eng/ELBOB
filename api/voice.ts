import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const SYSTEM_INSTRUCTION = `أنت «البوب» - المعلم الافتراضي الصوتي لمادة المحاسبة المالية (الصف الثاني - البكالوريا المصرية).
أنت تتحدث مباشرة بالصوت مع الطالب في محادثة حية شبيهة بمكالمة هاتفية حقيقية.
قواعد الرد الصوتي:
1. أجب بأسلوب صوتي مباشر وواضح ومشجع (مثل: تمام يا بطل، ركز معايا...).
2. قدّم الحكم والتفسير المحاسبي بوضوح وإيجاز شديد في 2 إلى 3 أسطر فقط حتى تكون المكالمة الصوتية رشيقة وسريعة.
3. التزم حصرياً بمقرر المحاسبة المالية المصري للبكالوريا (الوحدات من 1 إلى 10).`;

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
      error: 'مفتاح GEMINI_API_KEY غير موجود في الإعدادات.',
    });
  }

  try {
    const { text, audioBase64, mimeType, voiceName = 'Puck' } = req.body || {};

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    let questionText = text ? text.trim() : '';

    // If audio was uploaded, transcribe it with Gemini first
    if (!questionText && audioBase64) {
      const audioPart = {
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audioBase64,
        },
      };

      const transcribeRes = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          audioPart,
          { text: 'فرّغ هذا التسجيل الصوتي بدقة تامة باللغة العربية. اكتب فقط ما قاله المتحدث.' },
        ],
      });

      questionText = transcribeRes.text?.trim() || '';
    }

    if (!questionText) {
      return res.status(400).json({ error: 'لم يتم استلام أي نص أو صوت صالح.' });
    }

    // 1. Generate fast accounting answer with gemini-3.1-flash-lite (sub-second)
    const chatResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: questionText,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
        maxOutputTokens: 250,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      },
    });

    const replyText = chatResponse.text?.trim() || 'عذراً، لم أتمكن من إعداد الإجابة، يرجى المحاولة ثانية.';

    // 2. Generate Real Gemini Voice Audio using gemini-3.8-flash-lite-tts
    let audioWavBase64 = '';
    try {
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: replyText.replace(/[#*`_~|]/g, ''),
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const audioPart = ttsResponse.candidates?.[0]?.content?.parts?.[0];
      if (audioPart?.inlineData?.data) {
        audioWavBase64 = audioPart.inlineData.data;
      }
    } catch (ttsErr: any) {
      console.warn('Real Gemini TTS error, client will fallback to speech synthesis:', ttsErr.message || ttsErr);
    }

    return res.status(200).json({
      userText: questionText,
      modelText: replyText,
      audioBase64: audioWavBase64, // Real studio-quality Gemini voice WAV
    });
  } catch (error: any) {
    console.error('Voice chat pipeline error:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ في معالجة الصوت' });
  }
}
