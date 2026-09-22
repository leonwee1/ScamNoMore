/** Risk buckets shared with the mobile app (src/theme.ts). */
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Canonical analysis result returned by every analyzer endpoint. Matches the
 * app-side `AnalysisResult` in src/services/analysis.ts so the UI can render
 * Bedrock output without any transformation.
 */
export interface AnalysisResult {
  probability: number; // 0..1
  riskLevel: RiskLevel;
  scamType?: string;
  reasons: string[];
  detectedText?: string;
  advice: string;
  /** Raw signals gathered before the LLM call (useful for debugging/audit). */
  signals?: AnalysisSignals;
}

/** Evidence collected from Rekognition / Transcribe before LLM reasoning. */
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

export const SCAM_TYPES = [
  'Phishing Scam',
  'Investment Scam',
  'Job Scam',
  'Romance Scam',
  'E-commerce Scam',
  'Government Officials Impersonation Scam',
  'Loan Scam',
  'Fake Friend Call Scam',
  'Tech Support Scam',
  'Social Media Impersonation',
  'Rental Scam',
  'Inheritance Scam',
  'Lottery Scam',
  'Others',
] as const;

export function riskFromProbability(p: number): RiskLevel {
  if (p >= 0.85) return 'critical';
  if (p >= 0.65) return 'high';
  if (p >= 0.4) return 'medium';
  if (p >= 0.2) return 'low';
  return 'safe';
}
