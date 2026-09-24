import { filenameFor, mimeOf } from '../lib/http';
import { detectHallucination, noSpeechResult } from '../lib/openai';
import { extractJsonObject, parseAnalysisJson } from '../lib/parse';
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserPrompt } from '../lib/prompts';
import { riskFromProbability } from '../lib/types';

describe('extractJsonObject', () => {
  it('extracts a bare JSON object', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it('strips markdown fences', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('ignores prose before and after', () => {
    expect(extractJsonObject('Analysis:\n{"a":1}\nHope that helps!')).toBe('{"a":1}');
  });

  it('handles nested objects', () => {
    expect(extractJsonObject('x {"a":{"b":2},"c":3} y')).toBe('{"a":{"b":2},"c":3}');
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

  const assessed = (raw: string) => {
    const result = parseAnalysisJson(raw);
    if (result.assessmentStatus !== 'assessed') throw new Error('Expected an assessed result');
    return result;
  };

  it('parses a well-formed response', () => {
    const r = assessed(valid);
    expect(r.probability).toBe(0.82);
    expect(r.scamType).toBe('E-commerce Scam');
    expect(r.reasons).toHaveLength(2);
    expect(r.advice).toBe('Do not pay.');
  });

  it('parses a fenced response with prose', () => {
    expect(assessed('Sure!\n```json\n' + valid + '\n```').probability).toBe(0.82);
  });

  it('converts percentages to 0..1', () => {
    const r = assessed('{"probability":93,"scamType":"Lottery Scam","reasons":["x"],"advice":"y"}');
    expect(r.probability).toBe(0.93);
  });

  it('withholds a negative probability instead of showing 0% safe', () => {
    expect(parseAnalysisJson('{"probability":-5,"reasons":["x"],"advice":"y"}')).toMatchObject({
      assessmentStatus: 'unable_to_assess',
      reason: 'invalid-model-probability',
    });
  });

  it('withholds an ambiguous fraction instead of guessing a risk band', () => {
    expect(parseAnalysisJson('{"probability":1.5,"reasons":["x"],"advice":"y"}')).toMatchObject({
      assessmentStatus: 'unable_to_assess',
    });
  });

  it('withholds absurd values rather than forcing a score', () => {
    expect(parseAnalysisJson('{"probability":250,"reasons":["x"],"advice":"y"}')).toMatchObject({
      assessmentStatus: 'unable_to_assess',
    });
  });

  it('treats 2..100 as a percentage', () => {
    expect(assessed('{"probability":100,"reasons":["x"],"advice":"y"}').probability).toBe(1);
    expect(assessed('{"probability":45,"reasons":["x"],"advice":"y"}').probability).toBe(0.45);
  });

  it('withholds a missing probability instead of defaulting to 0', () => {
    expect(parseAnalysisJson('{"scamType":"Others","reasons":["x"],"advice":"y"}')).toMatchObject({
      assessmentStatus: 'unable_to_assess',
    });
  });

  it('honors an explicit insufficient-evidence outcome without a score', () => {
    const result = parseAnalysisJson(
      JSON.stringify({
        assessmentStatus: 'unable_to_assess',
        reasons: ['The screenshot is too blurred to read.'],
        advice: 'Use a clearer screenshot and verify independently.',
      })
    );
    expect(result).toMatchObject({
      assessmentStatus: 'unable_to_assess',
      reason: 'insufficient-evidence',
    });
    expect('probability' in result).toBe(false);
  });

  it('normalises scam type casing to the canonical list', () => {
    const r = assessed('{"probability":0.5,"scamType":"phishing scam","reasons":["x"],"advice":"y"}');
    expect(r.scamType).toBe('Phishing Scam');
  });

  it('supplies fallbacks for missing reasons and advice', () => {
    const r = assessed('{"probability":0.5}');
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.advice).toMatch(/1799/);
  });

  it('caps reasons at five entries', () => {
    const many = JSON.stringify({ probability: 0.5, reasons: ['a', 'b', 'c', 'd', 'e', 'f'], advice: 'x' });
    expect(assessed(many).reasons).toHaveLength(5);
  });

  it('throws on responses with no JSON at all', () => {
    expect(() => parseAnalysisJson('I cannot help with that.')).toThrow(/Could not find JSON/);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseAnalysisJson('{"probability": }')).toThrow(/invalid JSON/);
  });
});

describe('buildAnalysisUserPrompt', () => {
  it('asks the model to return an explicit scoreless state for unreadable evidence', () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain('"assessmentStatus": "unable_to_assess"');
    expect(ANALYSIS_SYSTEM_PROMPT).not.toMatch(/return a low probability/i);
  });

  it('directs the model to read text and judge visual cues for images', () => {
    const p = buildAnalysisUserPrompt({ source: 'image' });
    expect(p).toMatch(/still image/i);
    expect(p).toMatch(/QR code/i);
    expect(p).toMatch(/implausible discounts/i);
    expect(p).toMatch(/endorsements/i);
  });

  it('includes the transcript for voice evidence', () => {
    const p = buildAnalysisUserPrompt({ source: 'voice', transcript: 'this is the police calling' });
    expect(p).toContain('this is the police calling');
    expect(p).toMatch(/voice recording/i);
  });

  it('explains that video analysis uses the audio track', () => {
    const p = buildAnalysisUserPrompt({ source: 'video', transcript: 'guaranteed returns' });
    expect(p).toMatch(/audio track/i);
    expect(p).toContain('guaranteed returns');
    expect(p).toMatch(/identify what the transcript.*about/i);
    expect(p).toMatch(/assess it even when it is benign/i);
  });

  it('handles a silent video honestly', () => {
    const p = buildAnalysisUserPrompt({ source: 'video', noSpeechDetected: true });
    expect(p).toMatch(/No speech could be detected/i);
    expect(p).toMatch(/cannot be assessed/i);
  });

  it('includes plain user text', () => {
    const p = buildAnalysisUserPrompt({ source: 'text', text: 'You have won $1m' });
    expect(p).toContain('You have won $1m');
  });
});

describe('noSpeechResult', () => {
  it('is unable to assess, with no probability or risk band', () => {
    const result = noSpeechResult('video');
    expect(result).toMatchObject({
      assessmentStatus: 'unable_to_assess',
      signals: { unableToAssessReason: 'no-speech' },
    });
    expect('probability' in result).toBe(false);
    expect('riskLevel' in result).toBe(false);
  });
});

describe('detectHallucination', () => {
  it('rejects a repeated music/metadata phrase without sentence punctuation', () => {
    const text = '詞曲 李宗盛 演唱 李宗盛 演唱 李宗盛 演唱 李宗盛 演唱 李宗盛 演唱';
    expect(detectHallucination(text, [])).toMatchObject({ hallucinated: true });
  });

  it('rejects a repeated filler loop from music', () => {
    const text = 'Oh, oh, oh, oh, oh, oh, oh, oh, oh, oh, oh, oh, oh, oh, oh.';
    expect(detectHallucination(text, [])).toMatchObject({ hallucinated: true });
  });

  it('keeps a normal spoken transcript with occasional repeated words', () => {
    const text = 'The caller said hello, then asked me to verify my bank account immediately.';
    expect(detectHallucination(text, [])).toEqual({ hallucinated: false });
  });
});

describe('content type helpers', () => {
  it('normalises a Content-Type header to its mime', () => {
    expect(mimeOf('image/jpeg; charset=utf-8', 'x')).toBe('image/jpeg');
    expect(mimeOf('', 'audio/m4a')).toBe('audio/m4a');
  });

  it('derives a Whisper-friendly filename from the mime', () => {
    // Whisper picks its decoder from the extension, so this must be right.
    expect(filenameFor('audio/m4a', 'm4a')).toBe('upload.m4a');
    expect(filenameFor('video/quicktime', 'mp4')).toBe('upload.mov');
    expect(filenameFor('audio/mpeg', 'm4a')).toBe('upload.mp3');
    expect(filenameFor('application/octet-stream', 'mp4')).toBe('upload.mp4');
  });
});

describe('riskFromProbability', () => {
  it('matches the app-side thresholds', () => {
    expect(riskFromProbability(0.1)).toBe('safe');
    expect(riskFromProbability(0.2)).toBe('low');
    expect(riskFromProbability(0.4)).toBe('medium');
    expect(riskFromProbability(0.65)).toBe('high');
    expect(riskFromProbability(0.85)).toBe('critical');
  });
});
