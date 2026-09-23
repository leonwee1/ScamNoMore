import OpenAI from 'openai';
import { WHISPER_MAX_BYTES } from './audio';
import { parseAnalysisJson } from './parse';
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  buildChatLanguageContext,
  buildDateContext,
  buildLanguageContext,
  CHAT_SYSTEM_PROMPT,
} from './prompts';
import { AnalysisResult, AnalysisSignals, riskFromProbability } from './types';

/**
 * OpenAI integration — the single AI provider for ScamNoMore.
 *
 *   Image  -> gpt-4o vision (reads on-screen text AND judges visual scam cues)
 *   Voice  -> Whisper transcription -> gpt-4o analysis
 *   Video  -> Whisper on the audio track -> gpt-4o analysis
 *   Text   -> gpt-4o analysis
 *   Chat   -> gpt-4o conversation
 */

/**
 * Whisper rejects files larger than 25 MB.
 *
 * Callers should hand us audio that has already been through
 * `extractAudioForTranscription`, which compresses well under this. The check in
 * `transcribeMedia` is a last-resort guard, not the primary limit — see
 * MAX_UPLOAD_BYTES in lib/audio.ts for what the API actually accepts.
 */
export const MAX_MEDIA_BYTES = WHISPER_MAX_BYTES;

/**
 * The four languages the app UI offers. These are already ISO-639-1 codes,
 * which is exactly what Whisper's `language` parameter expects.
 */
export const SUPPORTED_LANGUAGES = ['en', 'zh', 'ms', 'ta'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Validate a language code before handing it to Whisper. Anything unexpected
 * becomes `undefined` so we fall back to auto-detect rather than sending junk
 * that the API would reject.
 */
export function normalizeLanguage(value?: string): SupportedLanguage | undefined {
  // Accept regional tags like "en-SG" / "zh-Hans" by keeping the base code.
  const code = value?.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
    ? (code as SupportedLanguage)
    : undefined;
}

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o';
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1';

let cached: OpenAI | null = null;

/** Lazily create the client so a missing key fails with a clear message. */
export function getClient(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Put it in backend/.env (see backend/.env.example).'
    );
  }
  cached = new OpenAI({ apiKey });
  return cached;
}

/** Reset the memoised client (used by tests). */
export function resetClient(): void {
  cached = null;
}

/**
 * Wrap optional prompt text as a system message, or nothing when it is empty.
 * The language directive is empty for English, and sending a blank system
 * message would only waste tokens.
 */
function systemIf(content: string): Array<{ role: 'system'; content: string }> {
  return content ? [{ role: 'system', content }] : [];
}

/**
 * Explain why a completion came back without usable content.
 *
 * `content` can be null for several quite different reasons, and the old
 * "returned an empty response" message hid all of them. The OpenAI response
 * carries the actual cause in `finish_reason` and `refusal`, so report it.
 */
function emptyCompletionError(res: OpenAI.Chat.Completions.ChatCompletion, what: string): Error {
  const choice = res.choices[0];
  const reason = choice?.finish_reason;
  const refusal = (choice?.message as { refusal?: string } | undefined)?.refusal;

  if (refusal) {
    return new Error(`The model declined to analyse this ${what}: ${refusal}`);
  }
  if (reason === 'content_filter') {
    return new Error(
      `This ${what} was blocked by OpenAI's content filter, so it could not be analysed. ` +
        'Try a cropped screenshot showing just the message text.'
    );
  }
  if (reason === 'length') {
    return new Error(
      `The analysis was cut off before it could be completed (token limit). ` +
        'Please try again.'
    );
  }
  return new Error(
    `OpenAI returned no content for the ${what} (finish_reason: ${reason ?? 'unknown'}).`
  );
}

function toResult(raw: string, signals: AnalysisSignals): AnalysisResult {
  const parsed = parseAnalysisJson(raw);
  return {
    probability: parsed.probability,
    riskLevel: riskFromProbability(parsed.probability),
    scamType: parsed.scamType,
    reasons: parsed.reasons,
    advice: parsed.advice,
    detectedText: signals.transcript?.trim() || signals.text?.trim() || undefined,
    signals,
  };
}

/**
 * Analyze an image with gpt-4o vision. The model both reads the text in the
 * picture (replacing a separate OCR step) and judges visual scam cues such as
 * implausible discounts, fake endorsements, fake bank screens and QR codes.
 */
export async function analyzeImage(
  imageBytes: Buffer,
  mimeType: string,
  today?: string,
  language?: string
): Promise<AnalysisResult> {
  const signals: AnalysisSignals = { source: 'image' };
  const dataUrl = `data:${mimeType};base64,${imageBytes.toString('base64')}`;

  const res = await getClient().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    max_tokens: 900,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'system', content: buildDateContext(today) },
      ...systemIf(buildLanguageContext(language)),
      {
        role: 'user',
        content: [
          { type: 'text', text: buildAnalysisUserPrompt(signals) },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) {
    console.error(
      'Empty image completion:',
      JSON.stringify(
        {
          finish_reason: res.choices[0]?.finish_reason,
          refusal: (res.choices[0]?.message as { refusal?: string } | undefined)?.refusal,
          usage: res.usage,
          mimeType,
          bytes: imageBytes.byteLength,
        },
        null,
        2
      )
    );
    throw emptyCompletionError(res, 'image');
  }
  return toResult(raw, signals);
}

/**
 * Transcribe speech with Whisper. Accepts audio files and also video files
 * (mp4/mov/webm), from which Whisper reads the audio track — that is how the
 * video flow works without any frame extraction.
 */
export async function transcribeMedia(
  bytes: Buffer,
  filename: string,
  mimeType: string,
  language?: string
): Promise<string> {
  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    // Reached only if compression could not get a very long recording under the
    // cap (roughly 100+ minutes of speech).
    throw new Error(
      `The compressed audio is still ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB, ` +
        'above the 25 MB transcription limit. Please use a shorter recording.'
    );
  }

  // Node 18+ provides File globally; the SDK accepts it directly.
  const file = new File([new Uint8Array(bytes)], filename, { type: mimeType });
  const lang = normalizeLanguage(language);

  const res = (await getClient().audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
    // Pin the decoder to the language the user picked in the app. Whisper's
    // auto-detect judges from roughly the first 30 seconds only, and it
    // regularly mistakes short or accented English for Malay/Indonesian —
    // which then comes back as Malay text. Omitted (auto-detect) only when we
    // were given no usable code.
    ...(lang ? { language: lang } : {}),
    // Greedy decoding. Whisper is prone to inventing plausible-sounding filler
    // over silence or background noise, and a non-zero temperature makes that
    // worse.
    temperature: 0,
    // verbose_json adds per-segment confidence, which is the only way to tell a
    // real transcript from an invented one after the fact.
    response_format: 'verbose_json',
  })) as TranscriptionVerbose;

  const text = res.text?.trim() ?? '';
  const verdict = detectHallucination(text, res.segments ?? []);
  if (verdict.hallucinated) {
    console.warn(`Discarded hallucinated transcript (${verdict.reason}): ${JSON.stringify(text)}`);
    return '';
  }
  return text;
}

/** Subset of Whisper's verbose_json response that we rely on. */
interface TranscriptionVerbose {
  text?: string;
  language?: string;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  no_speech_prob: number;
  avg_logprob: number;
  text: string;
}

/**
 * Decide whether a transcript is Whisper output or Whisper invention.
 *
 * Fed silence or music, Whisper does not return an empty string. It emits fluent
 * stock phrases memorised from its training data — YouTube sign-offs
 * ("please like and subscribe…"), travel narration ("the scenery here is very
 * beautiful") — usually repeated, and it reports high confidence while doing it.
 *
 * Two independent signals, both requiring agreement before we discard anything,
 * because throwing away a real transcript is worse than passing a bad one on to
 * a user who can read and edit it:
 *
 *  1. Degenerate repetition — one short sentence filling the whole transcript.
 *  2. Whisper's own `no_speech_prob`, which runs high on invented segments.
 */
export function detectHallucination(
  text: string,
  segments: TranscriptionSegment[]
): { hallucinated: boolean; reason?: string } {
  if (!text) return { hallucinated: false };

  // Split on sentence enders in both Latin and CJK punctuation.
  const sentences = text
    .split(/[。．.!?！？\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = new Set(sentences);

  if (sentences.length >= 3 && unique.size === 1) {
    return {
      hallucinated: true,
      reason: `same sentence repeated ${sentences.length}x`,
    };
  }
  if (sentences.length >= 4 && unique.size <= sentences.length / 3) {
    return {
      hallucinated: true,
      reason: `only ${unique.size} unique of ${sentences.length} sentences`,
    };
  }

  // Whisper says there is probably no speech in every segment it produced.
  if (segments.length > 0) {
    const allNonSpeech = segments.every((s) => s.no_speech_prob >= 0.8);
    if (allNonSpeech) {
      return {
        hallucinated: true,
        reason: `all ${segments.length} segment(s) have no_speech_prob >= 0.8`,
      };
    }
  }

  return { hallucinated: false };
}

/** Analyze a transcript or user-supplied text with gpt-4o. */
export async function analyzeTextEvidence(
  text: string,
  source: 'voice' | 'video' | 'text',
  today?: string,
  language?: string
): Promise<AnalysisResult> {
  const signals: AnalysisSignals =
    source === 'text' ? { source: 'text', text } : { source, transcript: text };

  const res = await getClient().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    max_tokens: 900,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'system', content: buildDateContext(today) },
      ...systemIf(buildLanguageContext(language)),
      { role: 'user', content: buildAnalysisUserPrompt(signals) },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw emptyCompletionError(res, source === 'text' ? 'text' : 'recording');
  return toResult(raw, signals);
}

/** Result for a video whose audio track contained no speech. */
export function noSpeechResult(source: 'video' | 'voice'): AnalysisResult {
  const signals: AnalysisSignals = { source, noSpeechDetected: true };
  return {
    probability: 0,
    riskLevel: 'safe',
    scamType: undefined,
    reasons: [
      'No speech could be detected in the audio, so there was nothing to analyse.',
      source === 'video'
        ? 'This check reads the video’s spoken audio. A silent video cannot be assessed this way.'
        : 'The recording appears to be silent or too quiet to transcribe.',
    ],
    advice:
      source === 'video'
        ? 'Try a clip that contains speech, or screenshot the video and use the image check instead. If unsure about an offer, call 1799.'
        : 'Please record again and speak clearly, or type what happened instead. If unsure, call 1799.',
    signals,
  };
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Chatbot turn with conversation history. */
export async function chat(
  message: string,
  history: ChatTurn[] = [],
  today?: string,
  language?: string
): Promise<string> {
  // Keep the last 10 turns to bound cost and latency.
  const recent = history
    .filter((t) => t?.content?.trim())
    .slice(-10)
    .map((t) => ({ role: t.role, content: t.content }));

  // Avoid duplicating the current message if the app already appended it.
  const last = recent[recent.length - 1];
  const messages =
    last && last.role === 'user' && last.content === message
      ? recent
      : [...recent, { role: 'user' as const, content: message }];

  const res = await getClient().chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.5,
    max_tokens: 500,
    messages: [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      { role: 'system', content: buildDateContext(today) },
      ...systemIf(buildChatLanguageContext(language)),
      ...messages,
    ],
  });

  const reply = res.choices[0]?.message?.content?.trim();
  if (!reply) throw new Error('OpenAI returned an empty chat response');
  return reply;
}
