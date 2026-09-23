import { RiskLevel } from '../theme';

/**
 * Shared analysis types.
 *
 * NOTE: there is deliberately NO on-device scam heuristic here. Every verdict is
 * produced by OpenAI via the backend (see src/services/api.ts and
 * backend/src/lib/openai.ts). Keeping a local "guess" engine would risk showing
 * users a fabricated analysis, so the app either shows a real model result or a
 * clear error.
 */

/** Evidence the model was given, echoed back for transparency/auditing. */
export interface AnalysisSignals {
  source: 'image' | 'video' | 'voice' | 'text';
  /** Speech transcribed by Whisper (voice + video flows). */
  transcript?: string;
  /** Text the user supplied or edited. */
  text?: string;
  durationSeconds?: number;
  /** Set when a video's audio track contained no speech. */
  noSpeechDetected?: boolean;
  /** Why the app deliberately withheld a scam probability. */
  unableToAssessReason?: 'no-speech' | 'invalid-model-probability' | 'insufficient-evidence';
}

/**
 * Evidence-based result returned by the backend. It is distinct from an
 * inconclusive result so a failed score can never render as a green 0% gauge.
 */
export interface AssessedAnalysisResult {
  assessmentStatus: 'assessed';
  probability: number; // 0..1
  riskLevel: RiskLevel;
  scamType?: string;
  reasons: string[];
  detectedText?: string; // OCR text or transcript actually extracted by AWS
  advice: string;
  signals?: AnalysisSignals;
  /**
   * Language the model wrote `reasons` and `advice` in, stamped by the client at
   * request time. Lets the UI notice that a stored verdict no longer matches the
   * selected language and translate it, instead of showing a half-translated
   * screen.
   */
  language?: string;
}

/** Honest outcome when there is not enough reliable evidence to score. */
export interface UnableToAssessResult {
  assessmentStatus: 'unable_to_assess';
  scamType?: never;
  reasons: string[];
  advice: string;
  detectedText?: string;
  signals?: AnalysisSignals;
  language?: string;
}

/** Canonical analysis result returned by the backend. */
export type AnalysisResult = AssessedAnalysisResult | UnableToAssessResult;

/** Use this guard before rendering a probability, risk band, or gauge. */
export function isAssessed(result: AnalysisResult): result is AssessedAnalysisResult {
  // Keep this guard defensive at runtime too: JavaScript can still receive a
  // malformed object from an older/stale bundle even though TypeScript says the
  // assessed branch contains a number.
  return (
    result.assessmentStatus === 'assessed' &&
    Number.isFinite(result.probability) &&
    result.probability >= 0 &&
    result.probability <= 1
  );
}

/** Build a scoreless result for evidence that cannot safely be assessed. */
export function unableToAssessResult(
  source: AnalysisSignals['source'],
  reason: NonNullable<AnalysisSignals['unableToAssessReason']>
): UnableToAssessResult {
  return {
    assessmentStatus: 'unable_to_assess',
    reasons: [],
    advice: '',
    signals: {
      source,
      ...(reason === 'no-speech' ? { noSpeechDetected: true } : {}),
      unableToAssessReason: reason,
    },
  };
}

/**
 * Translation key for the short verdict shown under the gauge.
 *
 * Returns a key rather than a finished string so the label is localized at
 * render time by the active language, instead of being baked in as English.
 */
export function riskLabelKey(p: number): string {
  return `risk.${riskFromProbability(p)}`;
}

/** Map a probability to a risk band. Must stay in sync with the backend. */
export function riskFromProbability(p: number): RiskLevel {
  if (p >= 0.85) return 'critical';
  if (p >= 0.65) return 'high';
  if (p >= 0.4) return 'medium';
  if (p >= 0.2) return 'low';
  return 'safe';
}
