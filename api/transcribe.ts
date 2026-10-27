import { GoogleGenAI } from '@google/genai';

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
    const { audioBase64, mimeType } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ error: 'البيانات الصوتية غير متوفرة' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: audioBase64,
      },
    };

    let transcription = '';
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.5-transcribe', 'gemini-3.8-flash'];

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            audioPart,
            { text: 'فرّغ هذا التسجيل الصوتي بدقة تامة باللغة العربية. اكتب النص المنطوق فقط بدون أي تعليقات إضافية.' },
          ],
        });

        if (response.text && response.text.trim()) {
          transcription = response.text.trim();
          break;
        }
      } catch (err: any) {
        console.warn(`Transcribe model ${modelName} error:`, err.message || err);
      }
    }

    return res.status(200).json({ text: transcription });
  } catch (error: any) {
    console.error('Transcribe endpoint error:', error);
    return res.status(500).json({ error: error.message || 'فشل تفريغ الصوت' });
  }
}
