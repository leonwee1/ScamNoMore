import { SCAM_TYPES } from './types';

/**
 * Defensive parsing of the model's JSON verdict.
 *
 * We ask OpenAI for `response_format: json_object`, which guarantees syntactically
 * valid JSON — but not that the *fields* are sane. This layer validates and
 * clamps every value so a bad response can never produce a misleading verdict.
 */
export type ParsedAnalysis =
  | {
      assessmentStatus: 'assessed';
      probability: number;
      scamType: string;
      reasons: string[];
      advice: string;
    }
  | {
      assessmentStatus: 'unable_to_assess';
      reason: 'invalid-model-probability' | 'insufficient-evidence';
      reasons: string[];
      advice: string;
    };

export function parseAnalysisJson(raw: string): ParsedAnalysis {
  const json = extractJsonObject(raw);
  if (!json) {
    throw new Error('Could not find JSON in model response');
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error('Model returned invalid JSON');
  }

  const reasons = readReasons(obj);
  const advice = readAdvice(obj);

  // The model can explicitly say the supplied content was too unclear to
  // assess. Treat that as a real, scoreless outcome instead of inviting it to
  // make a low-confidence 0% guess.
  if (obj.assessmentStatus === 'unable_to_assess') {
    return {
      assessmentStatus: 'unable_to_assess',
      reason: 'insufficient-evidence',
      reasons: reasons.length
        ? reasons
        : ['The available evidence was too unclear to assess with confidence.'],
      advice,
    };
  }

  // 0 is a real very-low-risk verdict. Never use it as a fallback when the
  // model omitted or malformed its probability; return an explicit inconclusive
  // state instead. Percentages from 2 through 100 are accepted for robustness.
  const probability = normalizeProbability(obj.probability);
  if (probability === undefined) {
    return {
      assessmentStatus: 'unable_to_assess',
      reason: 'invalid-model-probability',
      reasons: ['The model response did not include a usable scam probability.'],
      advice,
    };
  }

  const scamTypeRaw = typeof obj.scamType === 'string' ? obj.scamType.trim() : '';
  const scamType =
    (SCAM_TYPES as readonly string[]).find(
      (t) => t.toLowerCase() === scamTypeRaw.toLowerCase()
    ) ?? (scamTypeRaw || 'Others');

  return {
    assessmentStatus: 'assessed',
    probability,
    scamType,
    reasons: reasons.length ? reasons : ['The model did not provide detailed reasoning.'],
    advice,
  };
}

function readReasons(obj: Record<string, unknown>): string[] {
  return Array.isArray(obj.reasons)
    ? obj.reasons.map((r) => String(r).trim()).filter(Boolean).slice(0, 5)
    : [];
}

function readAdvice(obj: Record<string, unknown>): string {
  return typeof obj.advice === 'string' && obj.advice.trim()
    ? obj.advice.trim()
    : 'Do not click links, transfer money, or share OTPs. If unsure, call the ScamShield helpline 1799.';
}

/** Normalize a valid model probability, or withhold the score when invalid. */
function normalizeProbability(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  if (numeric >= 0 && numeric <= 1) return Number(numeric.toFixed(2));
  if (numeric >= 2 && numeric <= 100) return Number((numeric / 100).toFixed(2));

  // 1–2 is ambiguous (1.5 could be 1.5% or 150%), and values above 100 are
  // not a trustworthy score. Neither can be quietly displayed as safe.
  return undefined;
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
