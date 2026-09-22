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
}

/**
 * Canonical analysis result returned by the backend. Mirrors
 * backend/src/lib/types.ts so responses render without transformation.
 */
export interface AnalysisResult {
  probability: number; // 0..1
  riskLevel: RiskLevel;
  scamType?: string;
  reasons: string[];
  detectedText?: string; // OCR text or transcript actually extracted by AWS
  advice: string;
  signals?: AnalysisSignals;
}

/** Map a probability to a risk band. Must stay in sync with the backend. */
export function riskFromProbability(p: number): RiskLevel {
  if (p >= 0.85) return 'critical';
  if (p >= 0.65) return 'high';
  if (p >= 0.4) return 'medium';
  if (p >= 0.2) return 'low';
  return 'safe';
}
