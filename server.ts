import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Shared Gemini client utility
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION = `أنت تطبيق "البوب" - المساعد الذكي لمادة المحاسبة المالية (الصف الثاني - البكالوريا المصرية).
أنت مقيّد حصرياً بالمنهج المصري والملفات المرفقة (الجزء الأول: الوحدات 1-5، والجزء الثاني: الوحدات 6-10).

قواعد الإجابة النموذجية المعتمدة (JRE - التفسير المدعوم بالأدلة):
1. في الأسئلة المباشرة والمراجعة وفقرة (فكّر):
   - أجب بصيغة [حكم + تفسير] موجزة ومباشرة من 1-3 جمل باستخدام أدوات الربط: (لأن... لذلك... وهذا يعني أن...).
2. في أسئلة JRE التحليلية الكبرى:
   - اتبع الهيكل المعتمد: [مقدمة تحدد المفهوم والموقف -> الحجة الأولى -> الحجة الثانية أو المضادة والرد عليها -> خاتمة بحكم مبرر متوازن].
3. في التمارين والعمليات الحسابية:
   - قدّم التمهيد الحسابي الرياضي بدقة.
   - قيود اليومية منسقة بدقة: من حـ/ ... إلى حـ/ ... مع المبالغ والشرح.
   - حسابات الأستاذ حرف T والترصيد، وميزان المراجعة، ومذكرة تسوية البنك، والقوائم المالية (المتاجرة، أ.خ، المركز المالي) بدقة تامة.
4. الأسلوب:
   - ابدأ بالحل مباشرة بدون مقدمات فارغة أو تكرار لنص السؤال.
   - لغة عربية فصحى واضحة وعبارات محاسبية معتمدة في المنهج المصري.`;

// Streaming Chat Endpoint with automatic resilience and model fallback
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'قائمة الرسائل مطلوبة' });
      return;
    }

    // Filter out messages with empty content
    const validMessages = messages.filter(
      (m: { role: string; content?: string }) => m && m.content && m.content.trim() !== ''
    );

    // CRITICAL: Gemini multi-turn conversation MUST start with a 'user' turn!
    // Skip any introductory 'model' messages
    const firstUserIndex = validMessages.findIndex((m: { role: string }) => m.role === 'user');
    const userStartedMessages = firstUserIndex !== -1 ? validMessages.slice(firstUserIndex) : validMessages;

    if (userStartedMessages.length === 0) {
      res.status(400).json({ error: 'يجب أن تبدأ المحادثة برسالة من المستخدم' });
      return;
    }

    // Merge consecutive turns with the same role to strictly alternate user/model
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const msg of userStartedMessages) {
      const role: 'user' | 'model' =
        msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user';

      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + msg.content;
      } else {
        contents.push({
          role,
          parts: [{ text: msg.content }],
        });
      }
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Stream generation with fast fallback if primary model experiences 503 or high demand
    let streamSuccess = false;
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

    for (const modelName of modelsToTry) {
      try {
        const responseStream = await ai.models.generateContentStream({
          model: modelName,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.1,
            ...(modelName.includes('3.8')
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }

        streamSuccess = true;
        break; // Successfully streamed response
      } catch (streamErr: any) {
        console.warn(`Model ${modelName} failed or busy:`, streamErr.message || streamErr);
        // Continue to next model in fallback list if not finished
      }
    }

    if (!streamSuccess) {
      res.write(`data: ${JSON.stringify({ error: 'عذراً، الخادم يواجه ضغطاً مؤقتاً، يرجى إعادة المحاولة بعد ثوانٍ.' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'حدث خطأ' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// Audio Transcription Endpoint using gemini-3.5-transcribe with fallback
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: 'البيانات الصوتية غير متوفرة' });
      return;
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: audioBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          { text: 'فرّغ هذا التسجيل الصوتي بدقة تامة باللغة العربية. اكتب النص المنطوق فقط بدون أي تعليقات إضافية.' },
        ],
      },
    });

    const transcription = response.text?.trim() || '';
    res.json({ text: transcription });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: error.message || 'فشل تفريغ الصوت' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
