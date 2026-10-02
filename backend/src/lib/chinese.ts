import OpenCC from 'opencc-js';

/**
 * The app's Chinese locale is Simplified Chinese as used in Singapore.
 *
 * Whisper and the chat/completion models understand `zh`, but that language
 * code does not select a writing system. Short recordings are therefore able
 * to come back in Traditional Chinese even when the UI is Simplified. Keep
 * the conversion at the backend boundary so every client (web, Expo Go and a
 * future native build) receives the same script.
 */
const traditionalToSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

export function toSimplifiedChinese(value: string): string {
  if (!value) return value;
  try {
    return traditionalToSimplified(value);
  } catch {
    // A conversion failure must never discard a real transcript or response.
    return value;
  }
}

export function toSimplifiedChineseList(values: string[]): string[] {
  return values.map(toSimplifiedChinese);
}
