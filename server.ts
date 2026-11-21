import 'dotenv/config';
import express from 'express';
import type {Request, Response} from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

interface CopilotMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface CopilotRequestBody {
  message?: string;
  history?: CopilotMessage[];
  context?: unknown;
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '1mb'}));

  app.post('/api/copilot', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to enable Command Copilot.',
      });
      return;
    }

    const body = (req.body || {}) as CopilotRequestBody;
    const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
    if (!userMessage) {
      res.status(400).json({error: 'Message is required.'});
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = [
      'You are SkyMap Response Command Copilot, an AI flood-intelligence and emergency dispatch assistant built on the Google Maps Platform.',
      'You are directly connected to the dispatcher’s live operational state provided below as JSON telemetry.',
      'Rules:',
      '1. Ground every recommendation in the provided live telemetry (zone names, corridors, 24h forecast QPF mm, current QPF mm, probability %, elevation m, terrain vulnerability, risk score, risk level, suggested dispatch zone, upstream surge warnings, staging sites, and active alerts).',
      '2. When asked about sandbag priority, evacuation routes, or regional triage, cite exact numbers (mm, elevation m, risk score, corridor) from the live telemetry.',
      '3. When asked about backup road routes (e.g. if Mombasa Road floods near South C), combine the provided zone coordinates, corridors, and staging sites with realistic urban arterial corridor guidance clearly labeled as tactical routing advice to verify against live road closures.',
      '4. When asked to draft bilingual SMS/WhatsApp alerts (e.g., English and Kiswahili), produce concise, ready-to-send emergency messages formatted cleanly with clear headings for English and Kiswahili.',
      '5. Keep answers structured, concise, actionable, and easy for an emergency operations dispatcher to scan rapidly.',
      '',
      'LIVE OPERATIONAL TELEMETRY:',
      JSON.stringify(body.context ?? {}, null, 2),
    ].join('\n');

    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    const contents = [
      ...history.map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{text: m.text}],
      })),
      {
        role: 'user' as const,
        parts: [{text: userMessage}],
      },
    ];

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
        },
      });

      const replyText = response.text?.trim();
      if (!replyText) {
        res.status(502).json({error: 'Command Copilot returned an empty response.'});
        return;
      }

      res.json({reply: replyText});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reach Gemini API.';
      console.error('Command Copilot error:', err);
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : 500;
      res.status(status).json({error: message});
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SkyMap Response server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
