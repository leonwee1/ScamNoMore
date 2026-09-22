import { readFileSync } from 'fs';
import { join } from 'path';
import { riskFromProbability } from '../services/analysis';
import { BackendNotConfiguredError, contentTypeFor, probabilityLabel } from '../services/api';

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

describe('probabilityLabel', () => {
  it('produces human labels across the range', () => {
    expect(probabilityLabel(0.05)).toBe('Very low risk');
    expect(probabilityLabel(0.3)).toBe('Low risk');
    expect(probabilityLabel(0.5)).toBe('Possible scam');
    expect(probabilityLabel(0.7)).toBe('Likely scam');
    expect(probabilityLabel(0.95)).toBe('Almost certainly a scam');
  });
});

describe('contentTypeFor', () => {
  it('detects image types from the extension', () => {
    expect(contentTypeFor('file:///photo.jpg', 'image')).toBe('image/jpeg');
    expect(contentTypeFor('file:///shot.PNG', 'image')).toBe('image/png');
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
