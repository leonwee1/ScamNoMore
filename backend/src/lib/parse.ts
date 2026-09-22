import { SCAM_TYPES } from './types';

/**
 * Defensive parsing of the model's JSON verdict.
 *
 * We ask OpenAI for `response_format: json_object`, which guarantees syntactically
 * valid JSON — but not that the *fields* are sane. This layer validates and
 * clamps every value so a bad response can never produce a misleading verdict.
 */
export interface ParsedAnalysis {
  probability: number;
  scamType: string;
  reasons: string[];
  advice: string;
}

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
  // Disambiguation matters. A naive "if (v > 1) v /= 100" would turn a model's
  // 1.5 into 0.015 — flipping an extreme-risk verdict into "safe", the most
  // dangerous possible misread for a scam detector. So:
  //   (1, 2)   -> a fraction that overshot; clamp UP to 1 (fail loud, not silent)
  //   [2, 100] -> a percentage; divide by 100
  //   > 100    -> nonsense; clamp to 1
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
