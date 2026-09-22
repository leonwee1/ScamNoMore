/**
 * Local development server — the fastest way to run the REAL AWS pipeline
 * (Rekognition + Transcribe + Bedrock) without deploying anything.
 *
 * It reuses the exact same Lambda handlers, so behaviour matches production.
 * Your laptop's AWS credentials are used (via the standard AWS credential
 * chain), and your phone talks to this server over your LAN.
 *
 * Usage:
 *   cd backend
 *   npm install
 *   $env:MEDIA_BUCKET="your-bucket"; $env:AWS_REGION="ap-southeast-1"
 *   npx ts-node src/local-server.ts
 *
 * Then set apiBaseUrl in app.json to http://<your-lan-ip>:3000
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import type { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

import { handler as analyzeImage } from './handlers/analyzeImage';
import { handler as analyzeText } from './handlers/analyzeText';
import { handler as analyzeVideo } from './handlers/analyzeVideo';
import { handler as chat } from './handlers/chat';
import { handler as transcribe } from './handlers/transcribe';
import { handler as uploadUrl } from './handlers/uploadUrl';

const PORT = Number(process.env.PORT ?? 3000);

const ROUTES: Record<string, APIGatewayProxyHandler> = {
  '/upload-url': uploadUrl,
  '/analyze/image': analyzeImage,
  '/analyze/video': analyzeVideo,
  '/analyze/text': analyzeText,
  '/transcribe': transcribe,
  '/chat': chat,
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const path = (req.url ?? '').split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    });
    return res.end();
  }

  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        ok: true,
        region: process.env.AWS_REGION ?? 'ap-southeast-1',
        bucket: process.env.MEDIA_BUCKET ?? '(not set)',
        model: process.env.BEDROCK_MODEL_ID ?? 'apac.anthropic.claude-3-5-sonnet-20240620-v1:0',
      })
    );
  }

  const route = ROUTES[path];
  if (!route || req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: `No route for ${req.method} ${path}` }));
  }

  const started = Date.now();
  try {
    const body = await readBody(req);
    // Minimal APIGatewayProxyEvent shape — handlers only read body/isBase64Encoded.
    const result = (await route(
      { body, isBase64Encoded: false } as never,
      {} as never,
      () => undefined
    )) as APIGatewayProxyResult;

    console.log(`${req.method} ${path} -> ${result.statusCode} (${Date.now() - started}ms)`);
    res.writeHead(result.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(result.body);
  } catch (err) {
    console.error(`${req.method} ${path} -> 500`, err);
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ message: err instanceof Error ? err.message : 'Unexpected error' }));
  }
});

server.listen(PORT, () => {
  console.log(`ScamNoMore backend listening on http://0.0.0.0:${PORT}`);
  console.log(`  region : ${process.env.AWS_REGION ?? 'ap-southeast-1'}`);
  console.log(`  bucket : ${process.env.MEDIA_BUCKET ?? '(MEDIA_BUCKET NOT SET!)'}`);
  console.log(
    `  model  : ${process.env.BEDROCK_MODEL_ID ?? 'apac.anthropic.claude-3-5-sonnet-20240620-v1:0'}`
  );
  console.log(`Routes: ${Object.keys(ROUTES).join(', ')}, /health`);
});
