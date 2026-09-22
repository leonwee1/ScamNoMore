import { extractJsonObject, parseAnalysisJson } from '../lib/bedrock';
import { buildAnalysisUserPrompt } from '../lib/prompts';
import { riskFromProbability } from '../lib/types';

describe('extractJsonObject', () => {
  it('extracts a bare JSON object', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it('strips markdown fences', () => {
    const raw = '```json\n{"a":1}\n```';
    expect(extractJsonObject(raw)).toBe('{"a":1}');
  });

  it('ignores prose before and after', () => {
    const raw = 'Here is my analysis:\n{"a":1}\nHope that helps!';
    expect(extractJsonObject(raw)).toBe('{"a":1}');
  });

  it('handles nested objects', () => {
    const raw = 'x {"a":{"b":2},"c":3} y';
    expect(extractJsonObject(raw)).toBe('{"a":{"b":2},"c":3}');
  });

  it('is not confused by braces inside strings', () => {
    const raw = '{"a":"a } brace","b":1}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it('handles escaped quotes inside strings', () => {
    const raw = '{"a":"he said \\"hi\\" }","b":1}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it('returns null when there is no object', () => {
    expect(extractJsonObject('no json here')).toBeNull();
  });
});

describe('parseAnalysisJson', () => {
  const valid = JSON.stringify({
    probability: 0.82,
    scamType: 'E-commerce Scam',
    reasons: ['Implausible 80% discount', 'Pressure to pay by PayNow'],
    advice: 'Do not pay.',
  });

  it('parses a well-formed response', () => {
    const r = parseAnalysisJson(valid);
    expect(r.probability).toBe(0.82);
    expect(r.scamType).toBe('E-commerce Scam');
    expect(r.reasons).toHaveLength(2);
    expect(r.advice).toBe('Do not pay.');
  });

  it('parses a fenced response with prose', () => {
    const r = parseAnalysisJson('Sure!\n```json\n' + valid + '\n```');
    expect(r.probability).toBe(0.82);
  });

  it('converts percentages to 0..1', () => {
    const r = parseAnalysisJson('{"probability":93,"scamType":"Lottery Scam","reasons":["x"],"advice":"y"}');
    expect(r.probability).toBe(0.93);
  });

  it('clamps negatives to 0', () => {
    expect(parseAnalysisJson('{"probability":-5,"reasons":["x"],"advice":"y"}').probability).toBe(0);
  });

  it('fails SAFE for a fraction that overshoots 1 (1.5 -> 1, never 0.015)', () => {
    // Regression guard: dividing 1.5 by 100 would report an extreme scam as "safe".
    expect(parseAnalysisJson('{"probability":1.5,"reasons":["x"],"advice":"y"}').probability).toBe(1);
  });

  it('clamps absurd values to 1', () => {
    expect(parseAnalysisJson('{"probability":250,"reasons":["x"],"advice":"y"}').probability).toBe(1);
  });

  it('treats 2..100 as a percentage', () => {
    expect(parseAnalysisJson('{"probability":100,"reasons":["x"],"advice":"y"}').probability).toBe(1);
    expect(parseAnalysisJson('{"probability":45,"reasons":["x"],"advice":"y"}').probability).toBe(0.45);
  });

  it('defaults a missing/invalid probability to 0', () => {
    const r = parseAnalysisJson('{"scamType":"Others","reasons":["x"],"advice":"y"}');
    expect(r.probability).toBe(0);
  });

  it('normalises scam type casing to the canonical list', () => {
    const r = parseAnalysisJson('{"probability":0.5,"scamType":"phishing scam","reasons":["x"],"advice":"y"}');
    expect(r.scamType).toBe('Phishing Scam');
  });

  it('supplies fallbacks for missing reasons and advice', () => {
    const r = parseAnalysisJson('{"probability":0.5}');
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.advice).toMatch(/1799/);
  });

  it('caps reasons at five entries', () => {
    const many = JSON.stringify({ probability: 0.5, reasons: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], advice: 'x' });
    expect(parseAnalysisJson(many).reasons).toHaveLength(5);
  });

  it('throws on responses with no JSON at all', () => {
    expect(() => parseAnalysisJson('I cannot help with that.')).toThrow(/Could not find JSON/);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseAnalysisJson('{"probability": }')).toThrow(/invalid JSON/);
  });
});

describe('buildAnalysisUserPrompt', () => {
  it('includes OCR text and flags QR codes', () => {
    const p = buildAnalysisUserPrompt({
      source: 'rekognition-image',
      ocrText: '80% OFF ultrasonic cleaner',
      hasQrCode: true,
      labels: ['Advertisement', 'Qr Code'],
    });
    expect(p).toContain('80% OFF ultrasonic cleaner');
    expect(p).toContain('QR CODE WAS DETECTED');
    expect(p).toContain('Advertisement');
    expect(p).toMatch(/still image/i);
  });

  it('describes the transcript for voice evidence', () => {
    const p = buildAnalysisUserPrompt({ source: 'transcribe', transcript: 'hello this is the police' });
    expect(p).toContain('hello this is the police');
    expect(p).toMatch(/voice recording/i);
  });

  it('notes when nothing could be extracted', () => {
    const p = buildAnalysisUserPrompt({ source: 'rekognition-video' });
    expect(p).toMatch(/No readable text/i);
  });

  it('reports the sampled frame count for video', () => {
    const p = buildAnalysisUserPrompt({ source: 'rekognition-video', ocrText: 'x', frameCount: 12 });
    expect(p).toContain('12 sampled video frames');
  });
});

describe('riskFromProbability (backend)', () => {
  it('matches the app-side thresholds', () => {
    expect(riskFromProbability(0.1)).toBe('safe');
    expect(riskFromProbability(0.2)).toBe('low');
    expect(riskFromProbability(0.4)).toBe('medium');
    expect(riskFromProbability(0.65)).toBe('high');
    expect(riskFromProbability(0.85)).toBe('critical');
  });
});
