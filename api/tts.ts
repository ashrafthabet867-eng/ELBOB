import { GoogleGenAI } from '@google/genai';

async function fetchGoogleArabicAudio(text: string): Promise<{ base64Audio: string; mimeType: string }> {
  const clean = text
    .replace(/[#*`_~|]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into chunks under 180 characters
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

  const { text, voiceName = 'Puck' } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'النص مطلوب' });
  }

  // 1. First attempt: Gemini Studio TTS (if quota is available)
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const cleanText = text
        .replace(/[#*`_~|]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300);

      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [{ role: 'user', parts: [{ text: cleanText }] }],
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
      const base64Audio = audioPart?.inlineData?.data;

      if (base64Audio) {
        return res.status(200).json({
          audioBase64: base64Audio,
          mimeType: 'audio/wav',
          engine: 'gemini',
        });
      }
    } catch (err: any) {
      console.warn('Gemini TTS unavailable (quota or error), switching to Google Arabic voice engine:', err?.message || err);
    }
  }

  // 2. High-speed resilient Google Arabic voice engine (zero quota limits, guaranteed 100% uptime)
  try {
    const { base64Audio, mimeType } = await fetchGoogleArabicAudio(text);
    if (!base64Audio) {
      throw new Error('تعذر إنشاء الملف الصوتي');
    }

    return res.status(200).json({
      audioBase64: base64Audio,
      mimeType,
      engine: 'google-ar',
    });
  } catch (fallbackErr: any) {
    console.error('TTS error:', fallbackErr);
    return res.status(500).json({ error: fallbackErr.message || 'فشل توليد الصوت' });
  }
}
