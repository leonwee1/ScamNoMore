import { datasetSummary } from '../data/scamStore';
import type { ScamRecord } from '../data/types';
import { AnalysisResult, AnalysisSignals, riskFromProbability } from './analysis';
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

/** Same limit in MB, for display in the UI. Keeps labels honest. */
export const MAX_MEDIA_MB = MAX_MEDIA_BYTES / 1024 / 1024;

const TIMEOUT_MS = 180_000; // Whisper on a 5-minute clip can take a while.

async function request<T>(
  pathName: string,
  init: { method?: 'GET' | 'POST'; body?: BodyInit; contentType?: string }
): Promise<T> {
  const base = requireBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.contentType) headers['Content-Type'] = init.contentType;
  // Shared secret so strangers who find the public URL can't spend the quota.
  if (config.appSecret) headers['x-app-secret'] = config.appSecret;

  try {
    const res = await fetch(`${base}${pathName}`, {
      method: init.method ?? 'POST',
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

/** JSON used by app-owned data routes, which must not receive model-only fields. */
const postPlainJson = <T,>(pathName: string, body: object): Promise<T> =>
  request<T>(pathName, { body: JSON.stringify(body), contentType: 'application/json' });

const getJson = <T,>(pathName: string): Promise<T> => request<T>(pathName, { method: 'GET' });

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
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
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
  kind: 'image' | 'audio' | 'video',
  explicitContentType?: string
): Promise<T> {
  const contentType = explicitContentType ?? contentTypeFor(uri, kind);
  const blob = await readFile(uri, kind);
  return request<T>(pathName, { body: blob, contentType });
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface NewReportInput {
  dateReported: string;
  scamType: string;
  town: string;
  description: string;
}

/** Anonymous message returned by the shared community-room API. */
export interface CommunityMessage {
  id: string;
  roomKey: string;
  text: string;
  createdAt: string;
  participantKey?: string;
}

export interface CommunityMessageCursor {
  createdAt: string;
  id: string;
}

export interface CommunityMessagePage {
  messages: CommunityMessage[];
  nextBefore?: CommunityMessageCursor;
}

export interface NewCommunityMessageInput {
  roomKey: string;
  text: string;
  participantId?: string;
}

/**
 * Record which language the model was asked to answer in, so the UI can later
 * detect that a stored verdict no longer matches the user's selection.
 */
function normaliseSignals(value: unknown): AnalysisSignals | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const source = raw.source;
  if (source !== 'image' && source !== 'video' && source !== 'voice' && source !== 'text') {
    return undefined;
  }
  return {
    source,
    ...(typeof raw.transcript === 'string' ? { transcript: raw.transcript } : {}),
    ...(typeof raw.text === 'string' ? { text: raw.text } : {}),
    ...(typeof raw.durationSeconds === 'number' ? { durationSeconds: raw.durationSeconds } : {}),
    ...(raw.noSpeechDetected === true ? { noSpeechDetected: true } : {}),
    ...(raw.unableToAssessReason === 'no-speech' ||
    raw.unableToAssessReason === 'invalid-model-probability' ||
    raw.unableToAssessReason === 'insufficient-evidence'
      ? { unableToAssessReason: raw.unableToAssessReason }
      : {}),
  };
}

/**
 * Treat every network response as untrusted. This protects users still hitting
 * an older backend too: its legacy silent-media `{ probability: 0, safe }`
 * response becomes an explicit unable-to-assess result before it reaches a gauge.
 */
export function normaliseAnalysisResult(value: unknown, language?: string): AnalysisResult {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const signals = normaliseSignals(raw.signals);
  const reasons = Array.isArray(raw.reasons)
    ? raw.reasons.filter((reason): reason is string => typeof reason === 'string').slice(0, 5)
    : [];
  const advice = typeof raw.advice === 'string' ? raw.advice : '';
  // Older backends may omit the top-level detectedText field even though they
  // echo the transcript in signals. Preserve that evidence so a scoreless
  // result can still tell the user what was actually analysed.
  const detectedText =
    typeof raw.detectedText === 'string' && raw.detectedText.trim()
      ? raw.detectedText.trim()
      : signals?.transcript?.trim() || signals?.text?.trim() || undefined;
  const probability = raw.probability;
  const unable =
    raw.assessmentStatus === 'unable_to_assess' ||
    signals?.noSpeechDetected === true ||
    typeof probability !== 'number' ||
    !Number.isFinite(probability) ||
    probability < 0 ||
    probability > 1;

  if (unable) {
    const unableToAssessReason =
      signals?.noSpeechDetected || signals?.unableToAssessReason === 'no-speech'
        ? 'no-speech'
        : signals?.unableToAssessReason === 'invalid-model-probability'
          ? 'invalid-model-probability'
          : signals?.unableToAssessReason === 'insufficient-evidence' ||
              raw.assessmentStatus === 'unable_to_assess'
            ? 'insufficient-evidence'
            : 'invalid-model-probability';
    return {
      assessmentStatus: 'unable_to_assess',
      reasons,
      advice,
      ...(detectedText ? { detectedText } : {}),
      ...(signals
        ? {
            signals: {
              ...signals,
              unableToAssessReason,
            },
          }
        : { signals: { source: 'text', unableToAssessReason } }),
      ...(language ? { language } : {}),
    };
  }

  return {
    assessmentStatus: 'assessed',
    probability,
    // The backend may be upgraded independently, so derive the label from the
    // validated score rather than trusting an arbitrary network riskLevel.
    riskLevel: riskFromProbability(probability),
    ...(typeof raw.scamType === 'string' && raw.scamType.trim() ? { scamType: raw.scamType.trim() } : {}),
    reasons,
    advice,
    ...(detectedText ? { detectedText } : {}),
    ...(signals ? { signals } : {}),
    ...(language ? { language } : {}),
  };
}

function stampLanguage(result: unknown, language?: string): AnalysisResult {
  return normaliseAnalysisResult(result, language);
}

/**
 * Conservative client-side guard for stale backends. Whisper can return a
 * non-empty loop for music even when an older server does not flag it. Treat a
 * dominant filler token or repeated phrase as no reliable speech so the fake
 * transcript never reaches the scam analyser.
 */
export function isLikelyHallucinatedTranscript(text: string): boolean {
  const tokens = text
    .trim()
    .split(/\s+/)
    .map((token) => token.toLocaleLowerCase().replace(/[.,!?，。！？;:]+/g, ''))
    .filter(Boolean);
  if (tokens.length < 9) return false;

  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const dominant = Math.max(...counts.values());
  if (dominant >= 6 && dominant >= Math.ceil(tokens.length * 0.6)) return true;

  const maxBlockSize = Math.min(12, Math.floor(tokens.length / 3));
  for (let size = 2; size <= maxBlockSize; size++) {
    const blockCounts = new Map<string, number>();
    for (let i = 0; i + size <= tokens.length; i++) {
      const key = tokens.slice(i, i + size).join('\u0001');
      blockCounts.set(key, (blockCounts.get(key) ?? 0) + 1);
    }
    for (const repeats of blockCounts.values()) {
      if (repeats >= 3 && repeats * size >= Math.max(9, Math.ceil(tokens.length * 0.55))) {
        return true;
      }
    }
  }
  return false;
}

/** Shared transcription call for both the audio and video flows. */
async function transcribe(
  uri: string,
  kind: 'audio' | 'video',
  language?: string,
  explicitContentType?: string
): Promise<{ text: string; noSpeechDetected: boolean }> {
  const res = await postMedia<{ text: string; noSpeechDetected?: boolean }>(
    `/transcribe${mediaQuery({ language })}`,
    uri,
    kind,
    explicitContentType
  );
  const text = res.text?.trim() ?? '';
  const likelyHallucinated = isLikelyHallucinatedTranscript(text);
  return {
    text: likelyHallucinated ? '' : text,
    // Treat an empty transcript as "no speech" even if the flag is absent, so an
    // older backend still produces the right message rather than a blank box.
    noSpeechDetected: res.noSpeechDetected === true || !text || likelyHallucinated,
  };
}

export const api = {
  /** Fetch the complete shared, unverified-report list for this Expo session. */
  async listReports(): Promise<ScamRecord[]> {
    const response = await getJson<{ reports?: ScamRecord[] }>('/reports');
    if (!Array.isArray(response.reports)) {
      throw new Error('Reports response did not include a reports list.');
    }
    return response.reports;
  },

  /** Persist a report first; only the server-assigned row is added to the UI. */
  async createReport(input: NewReportInput): Promise<ScamRecord> {
    const response = await postPlainJson<{ report?: ScamRecord }>('/reports', input);
    if (!response.report) throw new Error('Reports response did not include the new report.');
    return response.report;
  },

  /** Read one shared room. It is refreshed each time a user enters the room. */
  async listCommunityMessages(
    roomKey: string,
    before?: CommunityMessageCursor
  ): Promise<CommunityMessagePage> {
    const query = new URLSearchParams({ roomKey });
    if (before) {
      query.set('beforeCreatedAt', before.createdAt);
      query.set('beforeId', before.id);
    }
    const response = await getJson<CommunityMessagePage>(`/community/messages?${query.toString()}`);
    if (!Array.isArray(response.messages)) {
      throw new Error('Community response did not include a messages list.');
    }
    return {
      messages: response.messages,
      ...(response.nextBefore &&
      typeof response.nextBefore.createdAt === 'string' &&
      typeof response.nextBefore.id === 'string'
        ? { nextBefore: response.nextBefore }
        : {}),
    };
  },

  /** Persist an anonymous message; only the server-confirmed row reaches the UI. */
  async createCommunityMessage(input: NewCommunityMessageInput): Promise<CommunityMessage> {
    const response = await postPlainJson<{ message?: CommunityMessage }>('/community/messages', input);
    if (!response.message) throw new Error('Community response did not include the new message.');
    return response.message;
  },

  /**
   * gpt-4o vision: reads the text in the image and judges visual scam cues.
   * `language` is the selected UI language; the model writes its reasons and
   * advice in it, while `scamType` stays a canonical English enum value.
   */
  async analyzeImage(
    imageUri: string,
    language?: string,
    contentType?: string
  ): Promise<AnalysisResult> {
    return stampLanguage(
      await postMedia<unknown>(
        `/analyze/image${mediaQuery({ language })}`,
        imageUri,
        'image',
        contentType
      ),
      language
    );
  },

  /**
   * Whisper transcribes the video's audio track, then gpt-4o analyses it.
   * `language` is the app's selected UI language, passed so Whisper does not
   * have to guess (its auto-detect mistakes short or accented English for Malay).
   */
  async analyzeVideo(videoUri: string, language?: string): Promise<AnalysisResult> {
    return stampLanguage(
      await postMedia<unknown>(
        `/analyze/video${mediaQuery({ language })}`,
        videoUri,
        'video'
      ),
      language
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
  transcribeAudio(
    audioUri: string,
    language?: string,
    contentType?: string
  ): Promise<{ text: string; noSpeechDetected: boolean }> {
    return transcribe(audioUri, 'audio', language, contentType);
  },

  /**
   * Whisper on a video's audio track -> text.
   *
   * Same endpoint as audio: the backend strips the audio out with ffmpeg before
   * transcribing, so the container it arrives in makes no difference.
   */
  transcribeVideo(
    videoUri: string,
    language?: string
  ): Promise<{ text: string; noSpeechDetected: boolean }> {
    return transcribe(videoUri, 'video', language);
  },

  /**
   * gpt-4o analysis of the (user-editable) transcript.
   *
   * `source` keeps the evidence type accurate when re-analysing an edited
   * transcript: the prompt tells the model whether the words came from a voice
   * recording or a video's audio track.
   */
  async analyzeTranscript(
    text: string,
    language?: string,
    source: 'voice' | 'video' = 'voice'
  ): Promise<AnalysisResult> {
    return stampLanguage(
      await postJson<unknown>('/analyze/text', { text, source, language }),
      language
    );
  },

  /** gpt-4o analysis of arbitrary text (message / email / advertisement). */
  async analyzeTextContent(text: string, language?: string): Promise<AnalysisResult> {
    return stampLanguage(
      await postJson<unknown>('/analyze/text', { text, source: 'text', language }),
      language
    );
  },

  /**
   * Re-express already-generated prose in another language.
   *
   * Returns the same number of strings, in order. Used when the user switches
   * language after an analysis has finished.
   */
  async translate(texts: string[], language: string): Promise<string[]> {
    const res = await postJson<{ texts?: string[] }>('/translate', { texts, language });
    const out = res.texts;
    if (!Array.isArray(out) || out.length !== texts.length) {
      throw new Error('Translation response did not match the requested strings.');
    }
    return out;
  },

  /**
   * gpt-4o chatbot with conversation history, answering in `language`.
   *
   * Sends aggregate statistics for the app's case records so the assistant can
   * answer questions about them ("top 3 scam types in 2023"). The dataset is
   * bundled in the app and grows with user reports, so the backend cannot read
   * it directly — the figures have to travel with the request.
   */
  async chat(message: string, history: ChatTurn[], language?: string): Promise<string> {
    const { reply } = await postJson<{ reply: string }>('/chat', {
      message,
      history,
      language,
      appData: datasetSummary(),
    });
    return reply;
  },

  /** True when a backend URL is configured (used to warn in the UI). */
  isConfigured(): boolean {
    return Boolean(config.apiBaseUrl?.trim());
  },
};
