import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const SYSTEM_INSTRUCTION = `أنت «البوب» - معلم المحاسبة المالية (الصف الثاني - البكالوريا المصرية).
أنت تتحدث مباشرة وبسرعة فائقة مع الطالب في محادثة حية.
قواعد الرد:
1. أجب فوراً باختصار شديد ووضوح في 2 إلى 3 أسطر فقط.
2. اذكر الحكم المحاسبي متبوعاً بالتفسير المختصر بدقة وفق المنهج المصري.
3. كن مشجعاً ومباشراً بدون مقدمات أو تكرار لنص السؤال.`;

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
    const { text, audioBase64, mimeType, voiceName = 'Puck', generateAudio = false } = req.body || {};

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    let questionText = text ? text.trim() : '';

    // If audio was uploaded, transcribe it fast with Gemini
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

    // 1. Ultra-fast answer generation with gemini-3.1-flash-lite (sub-second)
    const chatResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: questionText,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        maxOutputTokens: 200,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      },
    });

    const replyText = chatResponse.text?.trim() || 'عذراً، لم أتمكن من إعداد الإجابة، يرجى المحاولة ثانية.';

    // 2. Generate Real Gemini Voice Audio only if requested
    let audioWavBase64 = '';
    if (generateAudio) {
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
        console.warn('Gemini TTS error:', ttsErr.message || ttsErr);
      }
    }

    return res.status(200).json({
      userText: questionText,
      modelText: replyText,
      audioBase64: audioWavBase64,
    });
  } catch (error: any) {
    console.error('Voice chat pipeline error:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ في معالجة الصوت' });
  }
}
