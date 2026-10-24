import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
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

// Load the attached course guide and model answer documents into knowledge context
let attachedKnowledge = '';
try {
  const file1Path = path.resolve(__dirname, 'public/assets/aistudio/____________________56d26724.md');
  const file2Path = path.resolve(__dirname, 'public/assets/aistudio/______________________61b70fd9.md');
  if (fs.existsSync(file1Path)) {
    attachedKnowledge += '\n\n' + fs.readFileSync(file1Path, 'utf-8');
  }
  if (fs.existsSync(file2Path)) {
    attachedKnowledge += '\n\n' + fs.readFileSync(file2Path, 'utf-8');
  }
} catch (e) {
  console.error('Error reading attached markdown files:', e);
}

const SYSTEM_INSTRUCTION = `أنت تطبيق "البوب" - المساعد الذكي لمادة المحاسبة المالية (الصف الثاني - البكالوريا المصرية).
قواعد العمل الصارمة والإلزامية:
1. عملك وتحليلك وإجاباتك مقتصرة بشكل حصري وحتمي على المقرر والملفات المرفقة فقط الخاصة بالبكالوريا المصرية (الصف الثاني، الجزء الأول والجزء الثاني). لا تخرج عنها مطلقاً.
2. منهجية الإجابة النموذجية (JRE):
   - الأسئلة المباشرة/المراجعة/فكّر: إجابة نموذجية قصيرة محكمة تربط [الحكم + التفسير] باستخدام (لأن... لذلك... وهذا يعني أن...).
   - أسئلة JRE التحليلية الكبرى: إجابة منضبطة من [مقدمة تحدد المفهوم والحكم -> الحجة الأولى -> الحجة الثانية أو المضادة -> خاتمة بحكم مبرر متوازن].
3. قيود اليومية والحسابات:
   - استخدم القيود المحاسبية الدقيقة وحسابات T والقوائم المالية المعتمدة في الملفات:
     * الوحدة 1: معادلة المحاسبة، الحيطة والحذر، المقابلة، الثبات، الاستحقاق والنقدي، مجمل الربح وصافي الربح، قائمة المركز المالي.
     * الوحدة 2: القيد المزدوج، الأسئلة الاسترشادية الثلاثة، حساب T، ترصيد، ميزان المراجعة، الأخطاء التي تؤثر والتي لا تؤثر.
     * الوحدة 3: دفاتر اليومية المساعدة (المبيعات، المشتريات، المردودات، الخصم التجاري والنقدي، دفتر النقدية ذو 3 أعمدة، المصروفات النثرية).
     * الوحدة 4: ميزان المراجعة، قسمة الفرق على 2، الحساب المعلق، قيود التصحيح.
     * الوحدة 5: القوائم المالية للمنشأة الفردية، حساب المتاجرة، حساب أ.خ، التسويات الجردية (المصروف المقدم والمستحق، الإهلاك، الديون المعدومة).
     * الوحدة 6: السجلات غير المكتملة، حسابات المراقبة (مراقبة المبيعات والمشتريات)، مذكرة تسوية البنك.
     * الوحدة 7: الإهلاك (قسط ثابت وقسط متناقص)، استبعاد الأصول، مخصص الديون المشكوك في تحصيلها.
     * الوحدة 8: حسابات الشراكة، توزيع الأرباح والخسائر، فائدة رأس المال، رواتب الشركاء، الحساب الجاري، الشهرة.
     * الوحدة 9: الشركات ذات المسؤولية المحدودة، رأس مال الأسهم، الاحتياطيات، المنظمات غير الهادفة للربح (المقبوضات والمدفوعات، الإيرادات والمصروفات).
     * الوحدة 10: تحليل القوائم المالية، نسب الربحية، نسب السيولة (نسبة التداول، رأس المال العامل)، نسب الكفاءة (معدل دوران المخزون).
4. السرعة والإيجاز النموذجي: ابدأ بالإجابة مباشرة دون مقدمات طويلة بلا فائدة أو تكرار لنص السؤال. الوضوح أهم من الإطالة.

ملفات المنهج ونماذج الإجابات المعتمدة:
${attachedKnowledge}`;

// Streaming Chat Endpoint (Optimized for maximum speed)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'قائمة الرسائل مطلوبة' });
      return;
    }

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Use gemini-3.8-flash with LOW thinking level for super fast responses
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
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

// Audio Transcription Endpoint using gemini-3.5-transcribe
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

startServer();
