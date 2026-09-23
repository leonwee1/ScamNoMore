import { readFileSync } from 'fs';
import { join } from 'path';
import { isAssessed, riskFromProbability, riskLabelKey } from '../services/analysis';
import { BackendNotConfiguredError, contentTypeFor, normaliseAnalysisResult } from '../services/api';
import { _dicts } from '../i18n';

describe('riskFromProbability', () => {
  it('maps probabilities to levels', () => {
    expect(riskFromProbability(0.05)).toBe('safe');
    expect(riskFromProbability(0.25)).toBe('low');
    expect(riskFromProbability(0.5)).toBe('medium');
    expect(riskFromProbability(0.7)).toBe('high');
    expect(riskFromProbability(0.95)).toBe('critical');
  });

  it('uses inclusive lower bounds at the band edges', () => {
    expect(riskFromProbability(0.2)).toBe('low');
    expect(riskFromProbability(0.4)).toBe('medium');
    expect(riskFromProbability(0.65)).toBe('high');
    expect(riskFromProbability(0.85)).toBe('critical');
  });
});

describe('riskLabelKey', () => {
  it('produces a translation key across the range', () => {
    expect(riskLabelKey(0.05)).toBe('risk.safe');
    expect(riskLabelKey(0.3)).toBe('risk.low');
    expect(riskLabelKey(0.5)).toBe('risk.medium');
    expect(riskLabelKey(0.7)).toBe('risk.high');
    expect(riskLabelKey(0.95)).toBe('risk.critical');
  });

  it('resolves in every supported language', () => {
    // A missing entry would render the raw key ("risk.high") to the user.
    for (const p of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      const key = riskLabelKey(p) as keyof (typeof _dicts)['en'];
      for (const lang of ['en', 'zh', 'ms', 'ta'] as const) {
        expect(_dicts[lang][key]).toBeTruthy();
      }
    }
  });
});

describe('contentTypeFor', () => {
  it('detects image types from the extension', () => {
    expect(contentTypeFor('file:///photo.jpg', 'image')).toBe('image/jpeg');
    expect(contentTypeFor('file:///shot.PNG', 'image')).toBe('image/png');
    expect(contentTypeFor('file:///animation.gif', 'image')).toBe('image/gif');
    expect(contentTypeFor('file:///pic.heic', 'image')).toBe('image/heic');
  });

  it('detects audio and video types', () => {
    expect(contentTypeFor('file:///rec.m4a', 'audio')).toBe('audio/m4a');
    expect(contentTypeFor('file:///clip.mov', 'video')).toBe('video/quicktime');
  });

  it('disambiguates mp4 by kind', () => {
    expect(contentTypeFor('file:///a.mp4', 'video')).toBe('video/mp4');
    expect(contentTypeFor('file:///a.mp4', 'audio')).toBe('audio/mp4');
  });

  it('falls back sensibly for unknown extensions', () => {
    expect(contentTypeFor('file:///blob', 'image')).toBe('image/jpeg');
    expect(contentTypeFor('file:///blob', 'audio')).toBe('audio/m4a');
    expect(contentTypeFor('file:///blob', 'video')).toBe('video/mp4');
  });

  it('ignores query strings', () => {
    expect(contentTypeFor('file:///photo.png?t=123', 'image')).toBe('image/png');
  });
});

describe('analysis response safety', () => {
  it('keeps a valid model probability as an assessed result', () => {
    const result = normaliseAnalysisResult({
      probability: 0.72,
      riskLevel: 'safe', // ignored; the client derives it from probability
      reasons: ['Urgency and an unfamiliar payment link.'],
      advice: 'Do not pay.',
      signals: { source: 'image' },
    });
    expect(isAssessed(result)).toBe(true);
    if (isAssessed(result)) {
      expect(result.probability).toBe(0.72);
      expect(result.riskLevel).toBe('high');
    }
  });

  it('never turns a missing or invalid probability into a green gauge', () => {
    for (const probability of [undefined, -1, Number.NaN, 101]) {
      const result = normaliseAnalysisResult({ probability, signals: { source: 'text' } });
      expect(isAssessed(result)).toBe(false);
      expect('probability' in result).toBe(false);
      expect('riskLevel' in result).toBe(false);
    }
  });

  it('upgrades the legacy silent-media safe response to unable to assess', () => {
    const result = normaliseAnalysisResult({
      probability: 0,
      riskLevel: 'safe',
      signals: { source: 'video', noSpeechDetected: true },
    });
    expect(isAssessed(result)).toBe(false);
    expect(result.signals?.unableToAssessReason).toBe('no-speech');
  });

  it('preserves an explicit invalid-model-probability reason', () => {
    const result = normaliseAnalysisResult({
      assessmentStatus: 'unable_to_assess',
      signals: { source: 'image', unableToAssessReason: 'invalid-model-probability' },
    });
    expect(isAssessed(result)).toBe(false);
    expect(result.signals?.unableToAssessReason).toBe('invalid-model-probability');
  });

  it('keeps explicit insufficient evidence scoreless', () => {
    const result = normaliseAnalysisResult({
      assessmentStatus: 'unable_to_assess',
      signals: { source: 'image', unableToAssessReason: 'insufficient-evidence' },
    });
    expect(isAssessed(result)).toBe(false);
    expect(result.signals?.unableToAssessReason).toBe('insufficient-evidence');
    expect('probability' in result).toBe(false);
  });
});

describe('no mock analyzers remain', () => {
  // Regression guard for the bug where the app showed fabricated OCR text
  // ("You have won the Singtel lucky draw...") as if AWS had detected it.
  const read = (rel: string) =>
    readFileSync(join(__dirname, '..', 'services', rel), 'utf8');

  it('api.ts contains no hardcoded sample OCR/transcript text', () => {
    const src = read('api.ts');
    expect(src).not.toMatch(/MOCK_OCR_SAMPLES/);
    expect(src).not.toMatch(/lucky draw/i);
    expect(src).not.toMatch(/hashPick/);
    expect(src).not.toMatch(/mockChat/);
    expect(src).not.toMatch(/useMockServices/);
  });

  it('analysis.ts contains no local scam-scoring heuristic', () => {
    const src = read('analysis.ts');
    expect(src).not.toMatch(/INDICATORS/);
    expect(src).not.toMatch(/export function analyzeText/);
  });

  it('every analyzer routes through the backend API', () => {
    const src = read('api.ts');
    for (const route of [
      '/analyze/image',
      '/analyze/video',
      '/analyze/text',
      '/transcribe',
      '/chat',
    ]) {
      expect(src).toContain(route);
    }
  });

  it('never references an API key or OpenAI directly from the app', () => {
    // The key must live only on the backend; anything bundled is extractable.
    const src = read('api.ts');
    expect(src).not.toMatch(/sk-[a-zA-Z0-9]/);
    expect(src).not.toMatch(/OPENAI_API_KEY/);
    expect(src).not.toMatch(/api\.openai\.com/);
  });

  it('throws a clear error when the backend is unconfigured', () => {
    const err = new BackendNotConfiguredError();
    expect(err.message).toMatch(/apiBaseUrl/);
    expect(err.name).toBe('BackendNotConfiguredError');
  });
});
