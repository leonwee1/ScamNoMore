import { analyzeText, riskFromProbability } from '../services/analysis';
import { mockChat, probabilityLabel } from '../services/aws';

describe('riskFromProbability', () => {
  it('maps probabilities to levels', () => {
    expect(riskFromProbability(0.05)).toBe('safe');
    expect(riskFromProbability(0.25)).toBe('low');
    expect(riskFromProbability(0.5)).toBe('medium');
    expect(riskFromProbability(0.7)).toBe('high');
    expect(riskFromProbability(0.95)).toBe('critical');
  });
});

describe('analyzeText', () => {
  it('flags phishing language with high probability', () => {
    const r = analyzeText(
      'URGENT: verify your account and confirm your password and OTP via this link http://dbs-secure.xyz within 12 hours'
    );
    expect(r.probability).toBeGreaterThanOrEqual(0.65);
    expect(r.scamType).toBe('Phishing Scam');
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('flags investment scam language', () => {
    const r = analyzeText('Guaranteed returns 30% weekly with USDT on MetaTrader, join for referral bonus');
    expect(r.scamType).toBe('Investment Scam');
    expect(r.probability).toBeGreaterThan(0.4);
  });

  it('returns low risk for benign text', () => {
    const r = analyzeText('Hi mum, dinner at 7pm tonight at the usual place?');
    expect(r.probability).toBeLessThan(0.2);
    expect(r.riskLevel).toBe('safe');
  });

  it('adds money/urgency signals', () => {
    const r = analyzeText('Please bank transfer $500 immediately, this is your final notice');
    expect(r.reasons.some((x) => /urgency/i.test(x))).toBe(true);
    expect(r.reasons.some((x) => /money/i.test(x))).toBe(true);
  });
});

describe('probabilityLabel', () => {
  it('produces human labels', () => {
    expect(probabilityLabel(0.9)).toMatch(/scam/i);
    expect(probabilityLabel(0.05)).toMatch(/low/i);
  });
});

describe('mockChat', () => {
  it('answers OTP questions with a warning', () => {
    expect(mockChat('should I share my OTP?')).toMatch(/never share/i);
  });
  it('has a sensible default', () => {
    expect(mockChat('hello there').length).toBeGreaterThan(10);
  });
});
