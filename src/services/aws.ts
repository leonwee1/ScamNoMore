import { AnalysisResult, riskFromProbability } from './analysis';
import { config } from './config';

/**
 * Service facade over the REAL AWS pipeline. There are no mock analyzers here:
 * every verdict and every chatbot reply comes from AWS.
 *
 *   analyzeImage      -> Rekognition (OCR/labels/moderation) + Bedrock (vision)
 *   analyzeVideo      -> Rekognition Video (text/labels) + Bedrock
 *   transcribeAudio   -> Amazon Transcribe
 *   analyzeTranscript -> Bedrock LLM
 *   chat              -> Bedrock LLM
 *
 * If the backend is not configured we throw a clear, actionable error rather
 * than inventing an answer — a fabricated verdict is worse than no verdict.
 */

export class BackendNotConfiguredError extends Error {
  constructor() {
    super(
      'AWS backend is not configured. Set "apiBaseUrl" in app.json (expo.extra) to your ' +
        'API Gateway URL or local dev server, then reload. See docs/AWS_SETUP.md.'
    );
    this.name = 'BackendNotConfiguredError';
  }
}

function requireBaseUrl(): string {
  const base = config.apiBaseUrl?.trim();
  if (!base) throw new BackendNotConfiguredError();
  return base.replace(/\/+$/, '');
}

const TIMEOUT_MS = 120_000; // Rekognition Video / Transcribe jobs can be slow.

async function callApi<T>(pathName: string, body: unknown): Promise<T> {
  const base = requireBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}${pathName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        if (text) message = text.slice(0, 300);
      }
      throw new Error(`${pathName} failed: ${message}`);
    }
    return JSON.parse(text) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`${pathName} timed out after ${TIMEOUT_MS / 1000}s. Please try again.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Guess a content type from a local file URI. */
export function contentTypeFor(uri: string, kind: 'image' | 'audio' | 'video'): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
    m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', caf: 'audio/x-caf', webm: 'audio/webm',
    mp4: kind === 'video' ? 'video/mp4' : 'audio/mp4', mov: 'video/quicktime',
  };
  if (map[ext]) return map[ext];
  return kind === 'image' ? 'image/jpeg' : kind === 'audio' ? 'audio/m4a' : 'video/mp4';
}

/**
 * Upload a local file to S3 through a presigned URL and return its object key.
 * Media goes straight to S3, so it never hits API Gateway's payload limit.
 */
export async function uploadMedia(
  uri: string,
  kind: 'image' | 'audio' | 'video'
): Promise<string> {
  const contentType = contentTypeFor(uri, kind);

  const { uploadUrl, key } = await callApi<{ uploadUrl: string; key: string }>('/upload-url', {
    kind,
    contentType,
  });

  // Read the local file as a blob and PUT it to the presigned URL.
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`);
  }

  return key;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const aws = {
  /** Rekognition (OCR + labels + moderation) then Bedrock vision analysis. */
  async analyzeImage(imageUri: string): Promise<AnalysisResult> {
    const key = await uploadMedia(imageUri, 'image');
    return callApi<AnalysisResult>('/analyze/image', { key });
  },

  /** Rekognition Video (text + labels across frames) then Bedrock analysis. */
  async analyzeVideo(videoUri: string): Promise<AnalysisResult> {
    const key = await uploadMedia(videoUri, 'video');
    return callApi<AnalysisResult>('/analyze/video', { key });
  },

  /** Amazon Transcribe: speech -> text. */
  async transcribeAudio(audioUri: string, lang?: string): Promise<string> {
    const key = await uploadMedia(audioUri, 'audio');
    const { text } = await callApi<{ text: string }>('/transcribe', { key, lang });
    return text;
  },

  /** Bedrock LLM analysis of the (user-editable) transcript. */
  async analyzeTranscript(text: string): Promise<AnalysisResult> {
    return callApi<AnalysisResult>('/analyze/text', { text, source: 'transcribe' });
  },

  /** Bedrock LLM analysis of arbitrary text (message / email / advertisement). */
  async analyzeTextContent(text: string): Promise<AnalysisResult> {
    return callApi<AnalysisResult>('/analyze/text', { text, source: 'text' });
  },

  /** Bedrock LLM chatbot with conversation history. */
  async chat(message: string, history: ChatTurn[]): Promise<string> {
    const { reply } = await callApi<{ reply: string }>('/chat', { message, history });
    return reply;
  },

  /** True when a backend URL is configured (used to warn in the UI). */
  isConfigured(): boolean {
    return Boolean(config.apiBaseUrl?.trim());
  },
};

/** Convert a probability into a short label for the results UI. */
export function probabilityLabel(p: number): string {
  const level = riskFromProbability(p);
  const map: Record<string, string> = {
    safe: 'Very low risk',
    low: 'Low risk',
    medium: 'Possible scam',
    high: 'Likely scam',
    critical: 'Almost certainly a scam',
  };
  return map[level];
}
