/**
 * ScamNoMore backend server (runs locally and on Render).
 *
 * ── WHERE THE OPENAI KEY GOES ────────────────────────────────────────────────
 * NOT in this file.
 *   Local : backend/.env  ->  OPENAI_API_KEY=sk-proj-...   (gitignored)
 *   Render: dashboard -> Environment -> OPENAI_API_KEY
 * dotenv loads .env at startup; src/lib/openai.ts reads process.env.
 * Never hardcode the key, and never ship it inside the Expo app.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Local:  npm run dev
 * Render: build `npm install && npm run build`, start `npm start`
 */
import 'dotenv/config';

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { handler as analyzeImage } from './handlers/analyzeImage';
import { handler as analyzeText } from './handlers/analyzeText';
import { handler as analyzeVideo } from './handlers/analyzeVideo';
import { handler as chat } from './handlers/chat';
import { handler as transcribe } from './handlers/transcribe';
import { handler as translate } from './handlers/translate';
import { MAX_UPLOAD_BYTES } from './lib/audio';
import { AUTH_HEADER, authEnabled, checkAuth } from './lib/auth';
import type { Handler } from './lib/http';
import { checkRateLimit, clientIdFrom, rateLimitConfig } from './lib/rateLimit';

const PORT = Number(process.env.PORT ?? 3000);

/**
 * Hard cap on request size.
 *
 * Well above OpenAI's 25 MB transcription limit on purpose: media uploads are
 * compressed to 16 kHz mono MP3 before transcription (see lib/audio.ts), so the
 * upload only has to fit here, not in Whisper's cap.
 */
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;

const ROUTES: Record<string, Handler> = {
  '/analyze/image': analyzeImage,
  '/analyze/video': analyzeVideo,
  '/analyze/text': analyzeText,
  '/transcribe': transcribe,
  '/translate': translate,
  '/chat': chat,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': `Content-Type, ${AUTH_HEADER}`,
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
};

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

function send(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...CORS, ...extraHeaders });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const [path, rawQuery] = (req.url ?? '').split('?');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  // Friendly landing page at the root — visiting the base URL in a browser is
  // the first thing anyone does, and a bare 404 there looks like a broken deploy.
  if (path === '/' || path === '') {
    return send(res, 200, {
      service: 'ScamNoMore backend',
      status: 'running',
      hint: 'This API is used by the ScamNoMore mobile app. Open /health for status.',
      endpoints: ['GET /health', ...Object.keys(ROUTES).map((r) => `POST ${r}`)],
    });
  }

  // Health check is public so Render's monitor (and you) can reach it.
  // It never reveals the key itself, only whether one is present.
  if (path === '/health') {
    return send(res, 200, {
      ok: true,
      provider: 'openai',
      chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
      transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1',
      apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
      authRequired: authEnabled(),
      rateLimits: rateLimitConfig(),
    });
  }

  const route = ROUTES[path];
  if (!route || req.method !== 'POST') {
    return send(res, 404, { message: `No route for ${req.method} ${path}` });
  }

  // 1. Shared-secret check — blocks strangers who find the public URL.
  const auth = checkAuth(req.headers[AUTH_HEADER] as string | undefined);
  if (!auth.allowed) {
    console.warn(`401 ${path} — ${auth.reason}`);
    return send(res, 401, { message: auth.reason ?? 'Unauthorized' });
  }

  // 2. Rate limit — caps how much of your OpenAI quota any one client can burn.
  const clientId = clientIdFrom(req.headers, req.socket.remoteAddress ?? undefined);
  const limit = checkRateLimit(clientId);
  if (!limit.allowed) {
    console.warn(`429 ${path} — ${clientId} — ${limit.reason}`);
    return send(
      res,
      429,
      { message: limit.reason ?? 'Too many requests' },
      limit.retryAfter ? { 'Retry-After': String(limit.retryAfter) } : {}
    );
  }

  const started = Date.now();
  try {
    const raw = await readBody(req);
    const result = await route({
      raw,
      contentType: req.headers['content-type'] ?? 'application/octet-stream',
      query: Object.fromEntries(new URLSearchParams(rawQuery ?? '')),
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
  const limits = rateLimitConfig();
  console.log(`\nScamNoMore backend listening on port ${PORT}`);
  console.log(`  chat model : ${process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o'}`);
  console.log(`  whisper    : ${process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1'}`);
  console.log(`  OpenAI key : ${keyOk ? 'loaded ✓' : '*** MISSING ***'}`);
  console.log(`  auth       : ${authEnabled() ? 'shared secret required ✓' : '*** OPEN (no secret) ***'}`);
  console.log(
    `  rate limit : ${limits.burstMax}/${limits.burstWindowMs / 1000}s burst, ${limits.dailyMax}/day`
  );

  if (!keyOk) {
    console.log('\n  ⚠  Set OPENAI_API_KEY (backend/.env locally, or Render → Environment)\n');
  }
  if (!authEnabled()) {
    console.log(
      '\n  ⚠  APP_SHARED_SECRET is not set — anyone who finds this URL can spend your\n' +
        '     OpenAI quota. Fine on localhost; SET IT before deploying publicly.\n'
    );
  }
  console.log(`Routes: ${Object.keys(ROUTES).join(', ')}, /health\n`);
});
