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
  /** Why ScamNoMore intentionally withheld a scam probability. */
  unableToAssessReason?: 'no-speech' | 'invalid-model-probability' | 'insufficient-evidence';
}

/**
 * A result based on usable evidence. It is deliberately distinct from an
 * inconclusive result: a failed score must never look like a 0% safe verdict.
 */
export interface AssessedAnalysisResult {
  assessmentStatus: 'assessed';
  probability: number; // 0..1
  riskLevel: RiskLevel;
  scamType?: string;
  reasons: string[];
  detectedText?: string;
  advice: string;
  signals?: AnalysisSignals;
}

/** Honest result when the evidence or model response cannot safely be scored. */
export interface UnableToAssessResult {
  assessmentStatus: 'unable_to_assess';
  scamType?: never;
  reasons: string[];
  detectedText?: string;
  advice: string;
  signals?: AnalysisSignals;
}

/** Canonical analysis result returned by every analyzer endpoint. */
export type AnalysisResult = AssessedAnalysisResult | UnableToAssessResult;

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
