/** Risk buckets shared with the mobile app (src/theme.ts). */
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/** Where the evidence came from. */
export type EvidenceSource = 'image' | 'video' | 'voice' | 'text';

/** Evidence gathered before the model reasoned about it (for transparency). */
export interface AnalysisSignals {
  source: EvidenceSource;
  /** Speech transcribed by Whisper (voice + video flows). */
  transcript?: string;
  /** Text the user supplied or edited. */
  text?: string;
  /** Duration of the analyzed media, when known. */
  durationSeconds?: number;
  /** Set when a video had no detectable speech. */
  noSpeechDetected?: boolean;
}

/**
 * Canonical analysis result returned by every analyzer endpoint. Matches the
 * app-side `AnalysisResult` so responses render without transformation.
 */
export interface AnalysisResult {
  probability: number; // 0..1
  riskLevel: RiskLevel;
  scamType?: string;
  reasons: string[];
  detectedText?: string;
  advice: string;
  signals?: AnalysisSignals;
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
