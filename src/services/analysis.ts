import { RiskLevel } from '../theme';

/**
 * Shared analysis types.
 *
 * NOTE: there is deliberately NO on-device scam heuristic here. Every verdict is
 * produced by AWS Bedrock (see src/services/aws.ts and backend/src/lib/bedrock.ts)
 * over evidence from Rekognition / Rekognition Video / Transcribe. Keeping a
 * local "guess" engine would risk showing users a fabricated analysis, so the
 * app either shows a real AWS result or a clear error.
 */

/** Evidence gathered by AWS before the LLM reasoned about it (for transparency). */
export interface AnalysisSignals {
  ocrText?: string;
  labels?: string[];
  moderationLabels?: string[];
  hasQrCode?: boolean;
  isScreenshot?: boolean;
  transcript?: string;
  frameCount?: number;
  source: 'rekognition-image' | 'rekognition-video' | 'transcribe' | 'text';
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
