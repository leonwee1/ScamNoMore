import { RiskLevel } from '../theme';

/**
 * Shared scam-analysis result shape returned by every analyzer (image, voice,
 * video, text). The wireframe requires a probability + human-readable reasoning
 * ("Picture of the analyzed area, showing the probability of it being a scam...").
 */
export interface AnalysisResult {
  probability: number; // 0..1
  riskLevel: RiskLevel;
  scamType?: string;
  reasons: string[];
  detectedText?: string; // OCR / transcription
  advice: string;
}

export function riskFromProbability(p: number): RiskLevel {
  if (p >= 0.85) return 'critical';
  if (p >= 0.65) return 'high';
  if (p >= 0.4) return 'medium';
  if (p >= 0.2) return 'low';
  return 'safe';
}

/**
 * Keyword/indicator weights grouped by scam category. Kept deliberately simple
 * and transparent so results are explainable — the real Bedrock prompt reuses
 * these categories to steer the LLM.
 */
const INDICATORS: Array<{ type: string; weight: number; terms: string[] }> = [
  { type: 'Phishing Scam', weight: 0.9, terms: ['verify your account', 'click the link', 'singpass', 'otp', 'suspended', 'unusual activity', 'confirm your password', 'bank', 'reactivate'] },
  { type: 'Investment Scam', weight: 0.9, terms: ['guaranteed returns', 'crypto', 'bitcoin', 'usdt', 'metatrader', 'double your', 'high returns', 'forex', 'mining pool', 'referral bonus'] },
  { type: 'Job Scam', weight: 0.85, terms: ['easy job', 'work from home', 'commission', 'telegram', 'upfront fee', 'training fee', 'daily payout', 'like and subscribe', 'complete tasks'] },
  { type: 'Government Officials Impersonation Scam', weight: 0.95, terms: ['police', 'arrest warrant', 'court', 'ica', 'iras', 'money laundering', 'fine', 'customs', 'moh', 'cpf'] },
  { type: 'Romance Scam', weight: 0.8, terms: ['i love you', 'send money', 'customs fee', 'hospital', 'stuck overseas', 'western union', 'gift', 'military'] },
  { type: 'E-commerce Scam', weight: 0.75, terms: ['paynow first', 'deposit', 'carousell', 'shopee', 'lazada', 'no meetup', 'limited stock', 'transfer to reserve'] },
  { type: 'Loan Scam', weight: 0.85, terms: ['instant loan', 'processing fee', 'insurance fee', 'low interest', 'no credit check', 'licensed moneylender'] },
  { type: 'Tech Support Scam', weight: 0.85, terms: ['your computer', 'virus detected', 'microsoft', 'apple support', 'remote access', 'system alert', 'call this number'] },
  { type: 'Lottery Scam', weight: 0.9, terms: ['you have won', 'lucky draw', 'jackpot', 'claim your prize', 'processing fee'] },
];

const URL_RE = /(https?:\/\/[^\s]+|\b[a-z0-9-]+\.(?:xyz|top|info|link|click|shop|live)\b)/i;
const MONEY_RE = /(\$|sgd|usd|paynow|bank transfer|transfer|wire)/i;
const URGENCY_RE = /(urgent|immediately|within \d+ (hours|minutes)|act now|final notice|last chance)/i;

/**
 * Analyze free text (OCR'd from an image, transcribed from audio/video, or
 * pasted) and return an explainable scam probability. This is the deterministic
 * core used by the on-device mock and mirrored by the Bedrock prompt in prod.
 */
export function analyzeText(text: string): AnalysisResult {
  const lower = text.toLowerCase();
  let best: { type: string; score: number; hits: string[] } = { type: 'Others', score: 0, hits: [] };

  for (const ind of INDICATORS) {
    const hits = ind.terms.filter((term) => lower.includes(term));
    if (!hits.length) continue;
    // Diminishing returns: first hit counts most.
    const score = ind.weight * (1 - Math.pow(0.6, hits.length));
    if (score > best.score) best = { type: ind.type, score, hits };
  }

  const reasons: string[] = [];
  let prob = best.score;

  if (best.hits.length) {
    reasons.push(`Language typical of ${best.type}: ${best.hits.slice(0, 4).join(', ')}.`);
  }
  if (URL_RE.test(text)) {
    prob = Math.min(1, prob + 0.15);
    reasons.push('Contains a link — legitimate agencies rarely ask you to click unfamiliar URLs.');
  }
  if (URGENCY_RE.test(lower)) {
    prob = Math.min(1, prob + 0.12);
    reasons.push('Uses urgency/pressure tactics to rush your decision.');
  }
  if (MONEY_RE.test(lower)) {
    prob = Math.min(1, prob + 0.1);
    reasons.push('Requests money transfer or payment.');
  }
  if (!reasons.length) {
    reasons.push('No strong scam indicators detected, but stay cautious with unsolicited messages.');
  }

  const riskLevel = riskFromProbability(prob);
  const advice =
    prob >= 0.4
      ? 'Do not click links, transfer money, or share OTP/passwords. Verify via official channels and consider calling the ScamShield helpline 1799.'
      : 'This looks low-risk, but never share OTPs or transfer money to unknown parties. When unsure, call 1799.';

  return {
    probability: Number(prob.toFixed(2)),
    riskLevel,
    scamType: best.hits.length ? best.type : undefined,
    reasons,
    detectedText: text,
    advice,
  };
}
