import { AnalysisResult } from './analysis';
import { config } from './config';
import { deviceToday } from './dates';

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

/**
 * Largest media upload the backend accepts.
 *
 * This is NOT OpenAI's 25 MB transcription limit. The backend strips the audio
 * out with ffmpeg and compresses it to 16 kHz mono MP3 before transcribing, so a
 * large video is fine — only its speech has to fit in OpenAI's cap. Checked here
 * purely to fail fast with a clear message instead of uploading for a minute
 * first.
 */
export const MAX_MEDIA_BYTES = 64 * 1024 * 1024;

const TIMEOUT_MS = 180_000; // Whisper on a 5-minute clip can take a while.

async function request<T>(
  pathName: string,
  init: { body: BodyInit; contentType: string }
): Promise<T> {
  const base = requireBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = { 'Content-Type': init.contentType };
  // Shared secret so strangers who find the public URL can't spend the quota.
  if (config.appSecret) headers['x-app-secret'] = config.appSecret;

  try {
    const res = await fetch(`${base}${pathName}`, {
      method: 'POST',
      headers,
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

      // Turn the two protection responses into actionable guidance.
      if (res.status === 401) {
        throw new Error(
          'Not authorised by the server. Check that "appSecret" in app.json matches ' +
            'APP_SHARED_SECRET on the backend.'
        );
      }
      if (res.status === 429) {
        const retry = res.headers.get('Retry-After');
        throw new Error(
          `${message}${retry ? ` Please wait about ${retry}s and try again.` : ''}`
        );
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

/**
 * POST JSON, always stamping the device's date onto the body.
 *
 * The models have no clock of their own. Without `today` they judge dates
 * against their training cutoff and describe dates that have already passed as
 * being in the future.
 */
const postJson = <T,>(pathName: string, body: Record<string, unknown>): Promise<T> =>
  request<T>(pathName, {
    body: JSON.stringify({ ...body, today: deviceToday() }),
    contentType: 'application/json',
  });

/**
 * Build a query string for media endpoints. Those send the file as the entire
 * request body, so options have to travel in the URL.
 */
function mediaQuery(extra: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams({ today: deviceToday() });
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return `?${params.toString()}`;
}

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
      `This file is ${(blob.size / 1024 / 1024).toFixed(0)} MB. The limit is ` +
        `${MAX_MEDIA_BYTES / 1024 / 1024} MB — please use a shorter clip.`
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
  /**
   * gpt-4o vision: reads the text in the image and judges visual scam cues.
   * `language` is the selected UI language; the model writes its reasons and
   * advice in it, while `scamType` stays a canonical English enum value.
   */
  analyzeImage(imageUri: string, language?: string): Promise<AnalysisResult> {
    return postMedia<AnalysisResult>(
      `/analyze/image${mediaQuery({ language })}`,
      imageUri,
      'image'
    );
  },

  /**
   * Whisper transcribes the video's audio track, then gpt-4o analyses it.
   * `language` is the app's selected UI language, passed so Whisper does not
   * have to guess (its auto-detect mistakes short or accented English for Malay).
   */
  analyzeVideo(videoUri: string, language?: string): Promise<AnalysisResult> {
    return postMedia<AnalysisResult>(
      `/analyze/video${mediaQuery({ language })}`,
      videoUri,
      'video'
    );
  },

  /**
   * Whisper: speech -> text, decoded in the user's selected language.
   *
   * `noSpeechDetected` is set when the recording was silent or contained no
   * speech. In that case `text` is empty rather than the fluent nonsense Whisper
   * produces for silence, so the caller must tell the user instead of showing an
   * empty box.
   */
  async transcribeAudio(
    audioUri: string,
    language?: string
  ): Promise<{ text: string; noSpeechDetected: boolean }> {
    const res = await postMedia<{ text: string; noSpeechDetected?: boolean }>(
      `/transcribe${mediaQuery({ language })}`,
      audioUri,
      'audio'
    );
    return {
      text: res.text ?? '',
      noSpeechDetected: res.noSpeechDetected === true || !res.text?.trim(),
    };
  },

  /** gpt-4o analysis of the (user-editable) transcript. */
  analyzeTranscript(text: string, language?: string): Promise<AnalysisResult> {
    return postJson<AnalysisResult>('/analyze/text', { text, source: 'voice', language });
  },

  /** gpt-4o analysis of arbitrary text (message / email / advertisement). */
  analyzeTextContent(text: string, language?: string): Promise<AnalysisResult> {
    return postJson<AnalysisResult>('/analyze/text', { text, source: 'text', language });
  },

  /** gpt-4o chatbot with conversation history, answering in `language`. */
  async chat(message: string, history: ChatTurn[], language?: string): Promise<string> {
    const { reply } = await postJson<{ reply: string }>('/chat', {
      message,
      history,
      language,
    });
    return reply;
  },

  /** True when a backend URL is configured (used to warn in the UI). */
  isConfigured(): boolean {
    return Boolean(config.apiBaseUrl?.trim());
  },
};

