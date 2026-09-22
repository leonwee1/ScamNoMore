import { AnalysisResult, riskFromProbability } from './analysis';
import { config } from './config';

/**
 * Client for the ScamNoMore backend (OpenAI-powered).
 *
 *   analyzeImage      -> gpt-4o vision (reads text + judges visual scam cues)
 *   transcribeAudio   -> Whisper
 *   analyzeVideo      -> Whisper on the audio track -> gpt-4o
 *   analyzeTranscript -> gpt-4o
 *   chat              -> gpt-4o
 *
 * Media is POSTed as raw bytes with the file's Content-Type — no object storage,
 * no presigned URLs, no multipart. The API key lives only on the server.
 *
 * There are no mock analyzers: if the backend is unreachable we surface a clear
 * error rather than inventing a verdict.
 */

export class BackendNotConfiguredError extends Error {
  constructor() {
    super(
      'Backend is not configured. Set "apiBaseUrl" in app.json (expo.extra) to your ' +
        'server URL, then reload. See docs/SETUP.md.'
    );
    this.name = 'BackendNotConfiguredError';
  }
}

function requireBaseUrl(): string {
  const base = config.apiBaseUrl?.trim();
  if (!base) throw new BackendNotConfiguredError();
  return base.replace(/\/+$/, '');
}

/** Whisper's hard limit. Checked client-side for a friendlier message. */
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

const TIMEOUT_MS = 180_000; // Whisper on a 5-minute clip can take a while.

async function request<T>(
  pathName: string,
  init: { body: BodyInit; contentType: string }
): Promise<T> {
  const base = requireBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}${pathName}`, {
      method: 'POST',
      headers: { 'Content-Type': init.contentType },
      body: init.body,
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
      throw new Error(message);
    }
    return JSON.parse(text) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${TIMEOUT_MS / 1000}s. Please try again.`);
    }
    if (err instanceof TypeError) {
      // fetch() throws TypeError for network-level failures.
      throw new Error(
        `Cannot reach the backend at ${base}. Check it is running and that your phone is on the same network.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const postJson = <T,>(pathName: string, body: unknown): Promise<T> =>
  request<T>(pathName, { body: JSON.stringify(body), contentType: 'application/json' });

/** Guess a content type from a local file URI. */
export function contentTypeFor(uri: string, kind: 'image' | 'audio' | 'video'): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic',
    m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', caf: 'audio/wav', webm: 'audio/webm',
    mp4: kind === 'video' ? 'video/mp4' : 'audio/mp4', mov: 'video/quicktime',
  };
  if (map[ext]) return map[ext];
  return kind === 'image' ? 'image/jpeg' : kind === 'audio' ? 'audio/m4a' : 'video/mp4';
}

/** Read a local file URI into a Blob, enforcing the size limit up front. */
async function readFile(uri: string, kind: 'image' | 'audio' | 'video'): Promise<Blob> {
  const res = await fetch(uri);
  const blob = await res.blob();

  // Images are sent to a vision model, not Whisper, so only cap media files.
  if (kind !== 'image' && blob.size > MAX_MEDIA_BYTES) {
    throw new Error(
      `This file is ${(blob.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB — ` +
        'please use a shorter clip.'
    );
  }
  return blob;
}

/** POST raw media bytes to an endpoint. */
async function postMedia<T>(
  pathName: string,
  uri: string,
  kind: 'image' | 'audio' | 'video'
): Promise<T> {
  const contentType = contentTypeFor(uri, kind);
  const blob = await readFile(uri, kind);
  return request<T>(pathName, { body: blob, contentType });
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const api = {
  /** gpt-4o vision: reads the text in the image and judges visual scam cues. */
  analyzeImage(imageUri: string): Promise<AnalysisResult> {
    return postMedia<AnalysisResult>('/analyze/image', imageUri, 'image');
  },

  /** Whisper transcribes the video's audio track, then gpt-4o analyses it. */
  analyzeVideo(videoUri: string): Promise<AnalysisResult> {
    return postMedia<AnalysisResult>('/analyze/video', videoUri, 'video');
  },

  /** Whisper: speech -> text. */
  async transcribeAudio(audioUri: string): Promise<string> {
    const { text } = await postMedia<{ text: string }>('/transcribe', audioUri, 'audio');
    return text;
  },

  /** gpt-4o analysis of the (user-editable) transcript. */
  analyzeTranscript(text: string): Promise<AnalysisResult> {
    return postJson<AnalysisResult>('/analyze/text', { text, source: 'voice' });
  },

  /** gpt-4o analysis of arbitrary text (message / email / advertisement). */
  analyzeTextContent(text: string): Promise<AnalysisResult> {
    return postJson<AnalysisResult>('/analyze/text', { text, source: 'text' });
  },

  /** gpt-4o chatbot with conversation history. */
  async chat(message: string, history: ChatTurn[]): Promise<string> {
    const { reply } = await postJson<{ reply: string }>('/chat', { message, history });
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
