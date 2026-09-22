import OpenAI from 'openai';
import { parseAnalysisJson } from './parse';
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
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

/** Whisper rejects files larger than 25 MB. */
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

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
  mimeType: string
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
  if (!raw) throw new Error('OpenAI returned an empty response for the image');
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
  mimeType: string
): Promise<string> {
  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new Error(
      `File is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB — ` +
        'please trim the recording or use a shorter clip.'
    );
  }

  // Node 18+ provides File globally; the SDK accepts it directly.
  const file = new File([new Uint8Array(bytes)], filename, { type: mimeType });

  const res = await getClient().audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
    // Let Whisper auto-detect language (users may speak EN/ZH/MS/TA).
  });

  return res.text?.trim() ?? '';
}

/** Analyze a transcript or user-supplied text with gpt-4o. */
export async function analyzeTextEvidence(
  text: string,
  source: 'voice' | 'video' | 'text'
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
      { role: 'user', content: buildAnalysisUserPrompt(signals) },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('OpenAI returned an empty analysis response');
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
export async function chat(message: string, history: ChatTurn[] = []): Promise<string> {
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
    messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...messages],
  });

  const reply = res.choices[0]?.message?.content?.trim();
  if (!reply) throw new Error('OpenAI returned an empty chat response');
  return reply;
}
