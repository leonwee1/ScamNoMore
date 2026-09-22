/**
 * ScamNoMore backend server.
 *
 * ── WHERE THE OPENAI KEY GOES ────────────────────────────────────────────────
 * NOT in this file. Put it in `backend/.env`, which is gitignored:
 *
 *     OPENAI_API_KEY=sk-proj-xxxxxxxx
 *
 * dotenv (below) loads that file into process.env at startup, and
 * src/lib/openai.ts reads process.env.OPENAI_API_KEY. Never hardcode the key in
 * source, and never put it in the Expo app — anything bundled into the app can
 * be extracted from the build and billed to your account.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   cd backend
 *   npm install
 *   copy .env.example .env      # then paste your key into .env
 *   npm start
 *
 * Then set apiBaseUrl in app.json to http://<your-lan-ip>:3000
 */
import 'dotenv/config';

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { handler as analyzeImage } from './handlers/analyzeImage';
import { handler as analyzeText } from './handlers/analyzeText';
import { handler as analyzeVideo } from './handlers/analyzeVideo';
import { handler as chat } from './handlers/chat';
import { handler as transcribe } from './handlers/transcribe';
import type { Handler } from './lib/http';
import { MAX_MEDIA_BYTES } from './lib/openai';

const PORT = Number(process.env.PORT ?? 3000);

/** Hard cap on request size; Whisper itself rejects anything over 25 MB. */
const MAX_BODY_BYTES = MAX_MEDIA_BYTES + 1024 * 1024;

const ROUTES: Record<string, Handler> = {
  '/analyze/image': analyzeImage,
  '/analyze/video': analyzeVideo,
  '/analyze/text': analyzeText,
  '/transcribe': transcribe,
  '/chat': chat,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
};

/** Collect the raw body, rejecting oversized uploads early. */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`Body too large (limit ${Math.round(MAX_BODY_BYTES / 1024 / 1024)} MB)`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const path = (req.url ?? '').split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  if (path === '/health') {
    return send(res, 200, {
      ok: true,
      provider: 'openai',
      chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
      transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1',
      apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
  }

  const route = ROUTES[path];
  if (!route || req.method !== 'POST') {
    return send(res, 404, { message: `No route for ${req.method} ${path}` });
  }

  const started = Date.now();
  try {
    const raw = await readBody(req);
    const result = await route({
      raw,
      contentType: req.headers['content-type'] ?? 'application/octet-stream',
    });
    console.log(
      `${req.method} ${path} -> ${result.statusCode} ` +
        `(${(raw.byteLength / 1024).toFixed(0)} KB, ${Date.now() - started}ms)`
    );
    send(res, result.statusCode, result.body);
  } catch (err) {
    console.error(`${req.method} ${path} -> 500`, err);
    send(res, 500, { message: err instanceof Error ? err.message : 'Unexpected error' });
  }
});

server.listen(PORT, () => {
  const keyOk = Boolean(process.env.OPENAI_API_KEY);
  console.log(`\nScamNoMore backend listening on http://0.0.0.0:${PORT}`);
  console.log(`  chat model : ${process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o'}`);
  console.log(`  whisper    : ${process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1'}`);
  console.log(`  API key    : ${keyOk ? 'loaded from environment ✓' : '*** MISSING ***'}`);
  if (!keyOk) {
    console.log('\n  ⚠  Create backend/.env containing:');
    console.log('       OPENAI_API_KEY=sk-proj-your-key-here\n');
  }
  console.log(`Routes: ${Object.keys(ROUTES).join(', ')}, /health\n`);
});
