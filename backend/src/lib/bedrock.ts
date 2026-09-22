import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
} from '@aws-sdk/client-bedrock-runtime';
import {
  ANALYSIS_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
} from './prompts';
import {
  AnalysisResult,
  AnalysisSignals,
  SCAM_TYPES,
  riskFromProbability,
} from './types';

/**
 * Bedrock LLM access via the Converse API, which normalizes request/response
 * across model families (Anthropic Claude, Amazon Nova, Meta Llama, ...), so the
 * model can be swapped with an env var and no code change.
 */
const REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'apac.anthropic.claude-3-5-sonnet-20240620-v1:0';

const client = new BedrockRuntimeClient({ region: REGION });

/** Image formats Bedrock's Converse API accepts for vision input. */
export type BedrockImageFormat = 'jpeg' | 'png' | 'webp' | 'gif';

/** Low-level Converse call returning the assistant's text. */
export async function converse(
  system: string,
  messages: Message[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const res = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: system }],
      messages,
      inferenceConfig: {
        maxTokens: opts.maxTokens ?? 1024,
        // Low temperature for analysis => stable, reproducible verdicts.
        temperature: opts.temperature ?? 0.2,
      },
    })
  );

  const text = res.output?.message?.content
    ?.map((block) => ('text' in block ? block.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) throw new Error('Bedrock returned an empty response');
  return text;
}

/**
 * Run the scam analysis with Bedrock over evidence gathered from Rekognition /
 * Transcribe, and return a validated AnalysisResult.
 */
export async function analyzeWithBedrock(signals: AnalysisSignals): Promise<AnalysisResult> {
  const userPrompt = buildAnalysisUserPrompt(signals);
  const raw = await converse(
    ANALYSIS_SYSTEM_PROMPT,
    [{ role: 'user', content: [{ text: userPrompt }] }],
    { maxTokens: 900, temperature: 0.2 }
  );

  const parsed = parseAnalysisJson(raw);
  const detectedText = signals.transcript?.trim() || signals.ocrText?.trim() || undefined;

  return {
    probability: parsed.probability,
    riskLevel: riskFromProbability(parsed.probability),
    scamType: parsed.scamType,
    reasons: parsed.reasons,
    advice: parsed.advice,
    detectedText,
    signals,
  };
}

/**
 * Multimodal scam analysis: sends the ACTUAL IMAGE to Bedrock alongside the
 * Rekognition evidence, so the model can judge visual scam cues that OCR alone
 * misses — implausible "80% OFF" banners, fake news/brand mastheads, fake
 * doctor or celebrity endorsements, fake payment and login screens, QR codes.
 */
export async function analyzeImageWithBedrockVision(
  imageBytes: Uint8Array,
  format: BedrockImageFormat,
  signals: AnalysisSignals
): Promise<AnalysisResult> {
  const raw = await converse(
    ANALYSIS_SYSTEM_PROMPT,
    [
      {
        role: 'user',
        content: [
          { image: { format, source: { bytes: imageBytes } } },
          {
            text:
              'Look carefully at the attached image and combine what you SEE with the extracted evidence below. ' +
              'Also judge visual scam cues: implausible discounts, fake urgency or limited-stock banners, ' +
              'fake news or brand mastheads, fake doctor/celebrity endorsements, fake payment or bank screens, ' +
              'fake login pages, and QR codes.\n\n' +
              buildAnalysisUserPrompt(signals),
          },
        ],
      },
    ],
    { maxTokens: 900, temperature: 0.2 }
  );

  const parsed = parseAnalysisJson(raw);
  return {
    probability: parsed.probability,
    riskLevel: riskFromProbability(parsed.probability),
    scamType: parsed.scamType,
    reasons: parsed.reasons,
    advice: parsed.advice,
    detectedText: signals.ocrText?.trim() || undefined,
    signals,
  };
}

/** Conversational chatbot turn powered by Bedrock. */
export async function chatWithBedrock(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  // Keep the last 10 turns to bound cost/latency, and ensure the transcript
  // starts with a user turn (Converse requires alternating roles from 'user').
  const trimmed = history.slice(-10).filter((t) => t.content?.trim());
  const messages: Message[] = [];
  for (const turn of trimmed) {
    // Skip a leading assistant turn (e.g. our canned greeting).
    if (messages.length === 0 && turn.role !== 'user') continue;
    // Collapse consecutive same-role turns to satisfy the alternating rule.
    const last = messages[messages.length - 1];
    if (last && last.role === turn.role) {
      last.content = [...(last.content ?? []), { text: turn.content }];
      continue;
    }
    messages.push({ role: turn.role, content: [{ text: turn.content }] });
  }

  // Ensure the final turn is the user's current message.
  const last = messages[messages.length - 1];
  if (last?.role === 'user' && last.content?.some((c) => 'text' in c && c.text === message)) {
    // history already included the current message
  } else {
    messages.push({ role: 'user', content: [{ text: message }] });
  }

  return converse(CHAT_SYSTEM_PROMPT, messages, { maxTokens: 500, temperature: 0.5 });
}

interface ParsedAnalysis {
  probability: number;
  scamType: string;
  reasons: string[];
  advice: string;
}

/**
 * Defensively parse the model's JSON. LLMs sometimes wrap JSON in prose or
 * markdown fences, so we extract the first balanced object before parsing and
 * clamp/validate every field.
 */
export function parseAnalysisJson(raw: string): ParsedAnalysis {
  const json = extractJsonObject(raw);
  if (!json) {
    throw new Error(`Could not find JSON in model response: ${raw.slice(0, 200)}`);
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error(`Model returned invalid JSON: ${json.slice(0, 200)}`);
  }

  // Probability: accept either a 0..1 fraction or a 0..100 percentage.
  //
  // Disambiguation matters here. A naive "if (v > 1) v /= 100" would turn a
  // model's 1.5 into 0.015 — flipping an extreme-risk verdict into "safe",
  // which is the most dangerous possible misread for a scam detector. So:
  //   (1, 2)    -> a fraction that overshot; clamp up to 1 (fail safe/loud)
  //   [2, 100]  -> a percentage; divide by 100
  //   > 100     -> nonsense; clamp to 1
  let probability = Number(obj.probability);
  if (!Number.isFinite(probability)) probability = 0;
  if (probability > 1 && probability < 2) probability = 1;
  else if (probability >= 2 && probability <= 100) probability = probability / 100;
  else if (probability > 100) probability = 1;
  probability = Math.min(1, Math.max(0, probability));
  probability = Number(probability.toFixed(2));

  const scamTypeRaw = typeof obj.scamType === 'string' ? obj.scamType.trim() : '';
  const scamType =
    (SCAM_TYPES as readonly string[]).find(
      (t) => t.toLowerCase() === scamTypeRaw.toLowerCase()
    ) ?? (scamTypeRaw || 'Others');

  const reasons = Array.isArray(obj.reasons)
    ? obj.reasons.map((r) => String(r).trim()).filter(Boolean).slice(0, 5)
    : [];

  const advice =
    typeof obj.advice === 'string' && obj.advice.trim()
      ? obj.advice.trim()
      : 'Do not click links, transfer money, or share OTPs. If unsure, call the ScamShield helpline 1799.';

  return {
    probability,
    scamType,
    reasons: reasons.length ? reasons : ['The model did not provide detailed reasoning.'],
    advice,
  };
}

/** Extract the first balanced {...} block, ignoring markdown fences. */
export function extractJsonObject(text: string): string | null {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}
