import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import type { Lang } from '../i18n';

/**
 * Text-to-speech for analysis results, aimed at users who can read little of
 * their own language.
 *
 * Three things decide whether this sounds friendly-but-professional rather than
 * robotic:
 *
 * 1. VOICE CHOICE. Devices ship a low-quality "compact" voice plus, often, an
 *    Enhanced one. The compact voices are the flat, clipped ones people
 *    associate with robot speech, so we actively look for an Enhanced voice and
 *    only fall back to the default when none exists.
 *
 * 2. PROSODY. Pitch stays close to neutral — a raised pitch reads as cartoonish,
 *    which undercuts a scam warning. Rate is slightly under normal for clarity
 *    without dragging.
 *
 * 3. CHUNKING, which matters most. Speech engines compute an intonation contour
 *    per utterance, so one long string comes out as a flat drone. Queuing each
 *    sentence separately gives every one its own rise and fall, plus a natural
 *    pause between them.
 */

/**
 * Measured newsreader pace: deliberate enough to follow, not slow enough to
 * drag.
 */
const RATE = 0.95;

/**
 * EXACTLY neutral, and deliberately so.
 *
 * Any pitch other than 1.0 is applied as a post-hoc shift by the speech engine,
 * which smears formants and is a direct cause of thin, muffled output. An
 * earlier 1.03 was chasing "warmth" at the cost of clarity. A newsreader sounds
 * authoritative because of articulation and pacing, not a raised pitch.
 */
const PITCH = 1.0;

/** Always speak at full volume; the device's own control governs loudness. */
const VOLUME = 1.0;

/**
 * Preferred locales per app language, best first. Singapore variants come first
 * where they exist; a device that lacks them falls through to a common variant.
 */
const LOCALES: Record<Lang, string[]> = {
  en: ['en-SG', 'en-GB', 'en-AU', 'en-US', 'en'],
  zh: ['zh-CN', 'zh-SG', 'zh-TW', 'zh-HK', 'zh'],
  ms: ['ms-MY', 'ms'],
  ta: ['ta-IN', 'ta-SG', 'ta-LK', 'ta'],
};

interface ChosenVoice {
  locale: string;
  /** Platform voice id, when a better-than-default one was found. */
  identifier?: string;
}

let voiceCache: Speech.Voice[] | null = null;

async function voices(): Promise<Speech.Voice[]> {
  if (voiceCache) return voiceCache;
  try {
    voiceCache = await Speech.getAvailableVoicesAsync();
  } catch {
    // Web and some Android engines can reject this; fall back to locale-only.
    voiceCache = [];
  }
  return voiceCache;
}

/**
 * Score an installed voice for clarity, highest wins.
 *
 * Device voice catalogues mix broadcast-quality synthesis with decades-old
 * formant synthesisers, and the naming is the only reliable way to tell them
 * apart:
 *
 *  - "neural", "wavenet", "premium", "enhanced" mark modern high-fidelity
 *    voices. These are the ones that sound like a newsreader.
 *  - Google's Android voices tag their server-side models "network"; the
 *    "local" ones are markedly flatter.
 *  - "compact" is iOS's small on-device voice — thin and indistinct, and the
 *    most likely thing to have been picked before.
 *  - "eloquence" is iOS's legacy 1980s synthesiser. Unmistakably robotic.
 */
export function scoreVoice(v: Speech.Voice): number {
  const tag = `${v.identifier ?? ''} ${v.name ?? ''}`.toLowerCase();
  let s = 0;

  if (v.quality === Speech.VoiceQuality.Enhanced) s += 20;
  if (/neural|wavenet|premium|enhanced|studio|journey/.test(tag)) s += 15;
  if (/network/.test(tag)) s += 8;
  if (/compact/.test(tag)) s -= 20;
  if (/eloquence|espeak|pico/.test(tag)) s -= 40;
  if (/local/.test(tag)) s -= 3;

  return s;
}

/**
 * Pick the clearest installed voice for a language.
 */
export async function chooseVoice(lang: Lang): Promise<ChosenVoice> {
  const all = await voices();
  const prefs = LOCALES[lang];

  for (const locale of prefs) {
    const matches = all.filter((v) =>
      v.language?.toLowerCase().replace('_', '-').startsWith(locale.toLowerCase())
    );
    if (matches.length === 0) continue;

    const best = matches.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
    // Surfaced because which voices exist is device-specific and invisible
    // otherwise; this is the fastest way to explain a bad-sounding result.
    console.log(
      `TTS ${lang}: "${best.name ?? best.identifier}" (${best.language}, ` +
        `quality=${best.quality}, score=${scoreVoice(best)}) from ${matches.length} candidate(s)`
    );
    return { locale, identifier: best.identifier };
  }

  // No installed voice matched. Hand back the preferred locale anyway and let
  // the platform substitute — better than refusing to speak.
  return { locale: prefs[0] };
}

/** True when the device can actually speak this language. */
export async function hasVoiceFor(lang: Lang): Promise<boolean> {
  const all = await voices();
  if (all.length === 0) return true; // unknown; let it try rather than block
  const prefs = LOCALES[lang].map((l) => l.toLowerCase());
  return all.some((v) => {
    const vl = v.language?.toLowerCase().replace('_', '-') ?? '';
    return prefs.some((p) => vl.startsWith(p));
  });
}

/**
 * Split prose into utterance-sized pieces.
 *
 * Each becomes its own utterance so the engine gives it a fresh intonation
 * contour. Handles CJK punctuation as well as Latin, and keeps any trailing
 * fragment that has no final stop.
 */
export function toUtterances(text: string): string[] {
  return text
    .split(/(?<=[.!?。．！？；;])\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Put the audio session into playback mode before speaking.
 *
 * THIS IS THE FIX FOR QUIET SPEECH. The voice and chatbot screens call
 * setAudioModeAsync({ allowsRecording: true }) so they can record, which on iOS
 * switches the session to PlayAndRecord — and that category routes output to the
 * earpiece receiver rather than the loudspeaker. Playback afterwards is then
 * barely audible no matter where the volume slider sits, because it is coming
 * out of the tiny speaker you hold to your ear.
 *
 * playsInSilentMode also matters: without it an iPhone with the ringer switch
 * flipped to silent plays nothing at all.
 */
async function prepareForPlayback(): Promise<void> {
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  } catch {
    // Not fatal — on web there is no audio session to configure.
  }
}

export interface SpeakHandlers {
  onDone?: () => void;
  onError?: () => void;
}

/**
 * Speak a list of passages in order.
 *
 * Anything already queued is cancelled first, so tapping the button twice never
 * layers two readings on top of each other.
 */
export async function speak(
  passages: string[],
  lang: Lang,
  handlers: SpeakHandlers = {}
): Promise<void> {
  stop();

  const chunks = passages.flatMap((p) => toUtterances(p));
  if (chunks.length === 0) {
    handlers.onDone?.();
    return;
  }

  await prepareForPlayback();
  const { locale, identifier } = await chooseVoice(lang);

  chunks.forEach((chunk, i) => {
    const isLast = i === chunks.length - 1;
    Speech.speak(chunk, {
      language: locale,
      ...(identifier ? { voice: identifier } : {}),
      rate: RATE,
      pitch: PITCH,
      volume: VOLUME,
      // Only the final utterance reports completion, so the UI flips back to
      // "read aloud" when the whole result has finished rather than after the
      // first sentence.
      onDone: isLast ? handlers.onDone : undefined,
      onStopped: isLast ? handlers.onDone : undefined,
      onError: handlers.onError,
    });
  });
}

/** Stop immediately and drop anything still queued. */
export function stop(): void {
  // Throws on web if nothing is speaking; harmless either way.
  try {
    Speech.stop();
  } catch {
    // no-op
  }
}
