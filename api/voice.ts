import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { CURRICULUM_KNOWLEDGE_BASE } from './curriculumData';

const SYSTEM_INSTRUCTION = `أنت «البوب» - معلم المحاسبة المالية المعتمد (الصف الثاني - البكالوريا المصرية 2026).
أنت مقيّد حصرياً بمنهج الوزارة الرسمي ونماذج إجابات JRE المعتمدة أدناه (الوحدات 1-10).
قواعد الرد الصوتي السريع:
1. أجب فوراً باختصار شديد ووضوح في 2 إلى 3 جمل مركزة تناسب السماع الصوتي.
2. اذكر الحكم متبوعاً بالتفسير والدليل المحاسبي المعتمد وفق المنهج المصري حصراً.
3. كن مشجعاً ومباشراً بدون أي مقدمات أو تكرار للسؤال.

ملخص المنهج المعتمد:
${CURRICULUM_KNOWLEDGE_BASE}`;

async function fetchGoogleArabicAudio(text: string): Promise<{ base64Audio: string; mimeType: string }> {
  const clean = text
    .replace(/[#*`_~|]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into chunks under 180 characters for Google Translate TTS
  const chunks: string[] = [];
  const sentences = clean.split(/(?<=[.،؛؟!\n])/);
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length < 180) {
      current += (current ? ' ' : '') + sentence;
    } else {
      if (current) chunks.push(current);
      if (sentence.length < 180) {
        current = sentence;
      } else {
        const words = sentence.split(' ');
        let wordChunk = '';
        for (const w of words) {
          if ((wordChunk + ' ' + w).length < 180) {
            wordChunk += (wordChunk ? ' ' : '') + w;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = w;
          }
        }
        current = wordChunk;
      }
    }
    if (chunks.length >= 4) break;
  }
  if (current && chunks.length < 4) chunks.push(current);
  if (chunks.length === 0) chunks.push(clean.slice(0, 180));

  const audioBuffers: Buffer[] = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk.trim()
      )}&tl=ar&client=tw-ob`;
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        audioBuffers.push(Buffer.from(arrayBuffer));
      }
    } catch (e) {
      console.warn('Chunk audio fetch error:', e);
    }
  }

  const concatenated = Buffer.concat(audioBuffers);
  return {
    base64Audio: concatenated.toString('base64'),
    mimeType: 'audio/mpeg',
  };
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
      error: 'مفتاح GEMINI_API_KEY غير موجود في الإعدادات.',
    });
  }

  try {
    const { text, audioBase64, mimeType, voiceName = 'Puck', generateAudio = true } = req.body || {};

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
        maxOutputTokens: 220,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      },
    });

    const replyText = chatResponse.text?.trim() || 'عذراً، لم أتمكن من إعداد الإجابة، يرجى المحاولة ثانية.';

    // 2. Generate Real Voice Audio with dual-engine fallback
    let audioWavBase64 = '';
    let responseMimeType = 'audio/wav';

    if (generateAudio) {
      try {
        const speechText = replyText
          .replace(/[#*`_~|]/g, '')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 350);

        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text: speechText }],
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
          responseMimeType = 'audio/wav';
        }
      } catch (ttsErr: any) {
        console.warn('Gemini TTS quota or error, using Google Arabic voice engine:', ttsErr?.message || ttsErr);
      }

      // If Gemini TTS didn't produce audio (quota exceeded or error), use Google Arabic voice engine
      if (!audioWavBase64) {
        try {
          const fallback = await fetchGoogleArabicAudio(replyText);
          audioWavBase64 = fallback.base64Audio;
          responseMimeType = fallback.mimeType;
        } catch (fallbackErr) {
          console.error('Arabic voice fallback error:', fallbackErr);
        }
      }
    }

    return res.status(200).json({
      userText: questionText,
      modelText: replyText,
      audioBase64: audioWavBase64,
      mimeType: responseMimeType,
    });
  } catch (error: any) {
    console.error('Voice chat pipeline error:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ في معالجة الصوت' });
  }
}
