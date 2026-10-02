import { extractDictation, isWakePhrase, parseVoiceCommand, requiresVoiceConfirmation } from '../services/voiceCommands';

describe('voice command matching', () => {
  test.each([
    ['en', 'one two three one two three'],
    ['zh', '一二三 一二三'],
    ['ms', 'satu dua tiga satu dua tiga'],
    ['ta', 'ஒன்று இரண்டு மூன்று ஒன்று இரண்டு மூன்று'],
  ] as const)('recognises the %s wake phrase', (lang, phrase) => {
    expect(isWakePhrase(phrase, lang)).toBe(true);
  });

  test('recognises Mandarin numerals even when the browser mixes Han numerals and digits', () => {
    expect(isWakePhrase('一 二 三 1 2 3', 'zh')).toBe(true);
    expect(isWakePhrase('一二三一二三', 'zh')).toBe(true);
  });

  test('accepts natural English upload aliases', () => {
    expect(parseVoiceCommand('I want to upload a picture', 'en')).toEqual({
      type: 'media',
      target: 'imageLibrary',
    });
  });

  test.each([
    ['Search cases', { type: 'navigate', target: 'search' }],
    ['Go Search', { type: 'navigate', target: 'search' }],
    ['Go Report', { type: 'navigate', target: 'report' }],
    ['Report an incident', { type: 'navigate', target: 'report' }],
    ['Please take me to the report page', { type: 'navigate', target: 'report' }],
    ['Go community', { type: 'navigate', target: 'community' }],
    ['Exit chat room', { type: 'action', target: 'exitCommunity' }],
  ] as const)('recognises the English navigation phrase "%s"', (phrase, expected) => {
    expect(parseVoiceCommand(phrase, 'en')).toEqual(expected);
  });

  test('uses the selected language for Chinese commands', () => {
    expect(parseVoiceCommand('上传图片', 'zh')).toEqual({
      type: 'media',
      target: 'imageLibrary',
    });
    expect(parseVoiceCommand('upload an image', 'zh')).toBeNull();
  });

  test.each([
    ['switch to Chinese', { type: 'settings', target: 'languageZh' }],
    ['make text bigger', { type: 'settings', target: 'textBigger' }],
    ['I understand and continue', { type: 'action', target: 'acceptPrivacyConsent' }],
    ['show older messages', { type: 'action', target: 'showOlderMessages' }],
    ['read this aloud', { type: 'action', target: 'readCommunityGuidance' }],
    ['play audio', { type: 'action', target: 'playAnalysisAudio' }],
    ['play the sound', { type: 'action', target: 'playAnalysisAudio' }],
  ] as const)('recognises control command "%s"', (phrase, expected) => {
    expect(parseVoiceCommand(phrase, 'en')).toEqual(expected);
  });

  test('recognises Chinese settings commands', () => {
    expect(parseVoiceCommand('切换中文', 'zh')).toEqual({ type: 'settings', target: 'languageZh' });
    expect(parseVoiceCommand('放大文字', 'zh')).toEqual({ type: 'settings', target: 'textBigger' });
    expect(parseVoiceCommand('開啟搜索', 'zh')).toEqual({ type: 'navigate', target: 'search' });
  });

  test('recognises the privacy consent command in each supported language', () => {
    expect(parseVoiceCommand('continue with the analysis', 'en')).toEqual({ type: 'action', target: 'acceptPrivacyConsent' });
    expect(parseVoiceCommand('我了解并继续', 'zh')).toEqual({ type: 'action', target: 'acceptPrivacyConsent' });
    expect(parseVoiceCommand('Saya faham dan teruskan', 'ms')).toEqual({ type: 'action', target: 'acceptPrivacyConsent' });
    expect(parseVoiceCommand('நான் புரிந்துகொண்டு தொடர்கிறேன்', 'ta')).toEqual({ type: 'action', target: 'acceptPrivacyConsent' });
  });

  test.each([
    ['submitReport', true],
    ['sendCommunity', true],
    ['callHelpline', true],
    ['exitCommunity', false],
    ['playAnalysisAudio', false],
  ] as const)('confirms only consequential action "%s"', (target, expected) => {
    expect(requiresVoiceConfirmation(target)).toBe(expected);
  });

  test('keeps No separate from the explicit stop-listening command', () => {
    expect(parseVoiceCommand('No', 'en')).toEqual({ type: 'session', target: 'cancel' });
    expect(parseVoiceCommand('stop listening', 'en')).toEqual({ type: 'session', target: 'stop' });
  });

  test('does not interpret Hans saying now as the No command', () => {
    expect(parseVoiceCommand('Opening that now.', 'en')).toBeNull();
  });

  test('extracts free-form English and Chinese dictation', () => {
    expect(extractDictation('input this message: What is the top three scam types in 2024?', 'en'))
      .toBe('What is the top three scam types in 2024?');
    expect(extractDictation('输入这条消息：2024年最常见的三种诈骗是什么？', 'zh'))
      .toBe('2024年最常见的三种诈骗是什么？');
  });
});
