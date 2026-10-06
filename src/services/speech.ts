import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
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
let speechRequestId = 0;

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
function scoreVoiceQuality(v: Speech.Voice): number {
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
 * Browser-only preference. Browsers expose a much larger and more varied
 * catalogue than Expo's native speech bridge, so on web we can additionally
 * prefer voices that are explicitly labelled male. Keep this out of the
 * native path: before voice commands were added, Expo selected the clearest
 * voice in the phone's first matching locale, and changing that ordering
 * unexpectedly changed the voice users already knew.
 */
export function scoreVoice(v: Speech.Voice): number {
  let s = scoreVoiceQuality(v);
  const tag = `${v.identifier ?? ''} ${v.name ?? ''}`.toLowerCase();

  if (/\bmale\b|\bman\b|男声|男士|ஆண்|lelaki|andrew|arthur|alex|daniel|david|fred|james|john|mark|guy|rishi|yunxi|yunjian|yunyang|kangkang/.test(tag)) s += 60;
  if (/\bfemale\b|\bwoman\b|女声|女士|பெண்|wanita|ava|fiona|hazel|jenny|karen|moira|samantha|susan|tessa|victoria|zira|ting[- ]?ting|sin[- ]?ji|mei[- ]?jia|xiaoxiao/.test(tag)) s -= 60;

  return s;
}

/**
 * Pick the clearest installed voice for a language.
 */
export async function chooseVoice(lang: Lang): Promise<ChosenVoice> {
  const all = await voices();
  const prefs = LOCALES[lang];

  // Preserve Expo Go's pre-voice-command behaviour. Native voice catalogues
  // are device-specific and often contain several voices for one language.
  // The old policy selected the first preferred locale that exists, then the
  // clearest voice in that locale. This is intentionally not replaced by the
  // browser's global male-voice ranking, because doing so changes the voice
  // heard on an otherwise unchanged phone after installing a JS update.
  if (Platform.OS !== 'web') {
    for (const locale of prefs) {
      const prefix = locale.toLowerCase();
      const localeMatches = all.filter((voice) => {
        const language = voice.language?.toLowerCase().replace('_', '-') ?? '';
        return language.startsWith(prefix);
      });
      if (localeMatches.length === 0) continue;

      const best = localeMatches
        .slice()
        .sort((a, b) => scoreVoiceQuality(b) - scoreVoiceQuality(a))[0];
      console.log(
        `TTS ${lang}: "${best.name ?? best.identifier}" (${best.language}, ` +
          `quality=${best.quality}, native locale=${locale}) from ` +
          `${localeMatches.length} candidate(s)`
      );
      // Return the preferred locale bucket, as the previous implementation
      // did. Passing the device voice identifier keeps the selected native
      // voice while avoiding a locale substitution by Expo.
      return { locale, identifier: best.identifier };
    }

    return { locale: prefs[0] };
  }

  const matches = all.flatMap((voice) => {
    const language = voice.language?.toLowerCase().replace('_', '-') ?? '';
    const localeIndex = prefs.findIndex((locale) => language.startsWith(locale.toLowerCase()));
    return localeIndex >= 0 ? [{ voice, localeIndex }] : [];
  });
  if (matches.length > 0) {
    // Prefer a detectable male voice even when it is a slightly less-specific
    // locale (for example en-US) than an explicitly female en-SG voice.
    const bestMatch = matches.slice().sort((a, b) => {
      const aScore = scoreVoice(a.voice) * 10 - a.localeIndex;
      const bScore = scoreVoice(b.voice) * 10 - b.localeIndex;
      return bScore - aScore;
    })[0];
    const best = bestMatch.voice;
    // Surfaced because which voices exist is device-specific and invisible
    // otherwise; this is the fastest way to explain a bad-sounding result.
    console.log(
      `TTS ${lang}: "${best.name ?? best.identifier}" (${best.language}, ` +
        `quality=${best.quality}, score=${scoreVoice(best)}) from ${matches.length} candidate(s)`
    );
    // Keep the browser voice's own locale instead of only passing the preferred
    // locale bucket. Browser engines can otherwise substitute a different
    // voice when the requested bucket (for example en-SG) is not the voice's
    // actual locale.
    return {
      locale: best.language?.replace('_', '-') || prefs[bestMatch.localeIndex],
      identifier: best.identifier,
    };
  }

  // No installed voice matched. Hand back the preferred locale anyway and let
  // the platform substitute — better than refusing to speak.
  return { locale: prefs[0] };
}

/** True when the device can actually speak this language. */
export async function hasVoiceFor(lang: Lang): Promise<boolean> {
  // Browser speech-synthesis voice lists are often empty or populated after
  // the first utterance. Do not block playback based on that incomplete list;
  // the browser can still select its default voice for the requested locale.
  if (Platform.OS === 'web') return true;
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
 * Browser speech synthesis can emit transient pause events (and some Chrome
 * versions leave the queue paused after a tab or microphone interruption).
 * Use the browser API directly on web so those pauses can be recovered without
 * Expo's adapter deleting the utterance callback as if speech had stopped.
 */
function speakBrowser(
  chunks: string[],
  locale: string,
  identifier: string | undefined,
  requestId: number,
  handlers: SpeakHandlers,
): void {
  const root = globalThis as any;
  const synthesis = root.speechSynthesis;
  const Utterance = root.SpeechSynthesisUtterance;
  if (!synthesis || !Utterance) {
    handlers.onError?.();
    return;
  }

  const speakNext = (index: number) => {
    if (requestId !== speechRequestId) return;
    const utterance = new Utterance(chunks[index]);
    utterance.lang = locale;
    utterance.rate = RATE;
    utterance.pitch = PITCH;
    utterance.volume = VOLUME;
    const browserVoice = identifier
      ? Array.from(synthesis.getVoices?.() ?? []).find((voice: any) => voice.voiceURI === identifier)
      : undefined;
    if (browserVoice) utterance.voice = browserVoice;

    let settled = false;
    let pauseRecovery: any;
    const finish = (callback?: () => void) => {
      if (settled) return;
      settled = true;
      if (pauseRecovery) root.clearTimeout?.(pauseRecovery);
      if (requestId === speechRequestId) callback?.();
    };

    // A short pause event is normal in Chromium when the microphone stream
    // changes state. Resume only after it persists briefly; calling resume on
    // a fixed interval while audio is already playing can itself produce
    // clicks, clipped syllables, and an unclear voice.
    utterance.onpause = () => {
      if (pauseRecovery) root.clearTimeout?.(pauseRecovery);
      pauseRecovery = root.setTimeout?.(() => {
        pauseRecovery = undefined;
        if (requestId === speechRequestId && !settled && synthesis.paused) synthesis.resume();
      }, 250);
    };
    utterance.onresume = () => {
      if (pauseRecovery) root.clearTimeout?.(pauseRecovery);
      pauseRecovery = undefined;
    };
    utterance.onend = () => {
      if (index === chunks.length - 1) finish(handlers.onDone);
      else finish(() => speakNext(index + 1));
    };
    utterance.onerror = () => finish(handlers.onError);
    try {
      synthesis.speak(utterance);
    } catch {
      finish(handlers.onError);
    }
  };

  synthesis.resume();
  speakNext(0);
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
  const requestId = ++speechRequestId;
  // Speech.stop() is asynchronous on the web. Wait for cancellation before
  // queueing the next utterance so a paused/cancelled sentence cannot overlap
  // and cut the new sentence short.
  await cancelSpeech();

  const chunks = passages.flatMap((p) => toUtterances(p));
  if (chunks.length === 0) {
    handlers.onDone?.();
    return;
  }

  // Browser speech synthesis owns its own output session. Calling the native
  // audio-session helper on web adds an unnecessary asynchronous boundary and
  // can race the first utterance while the microphone is being released.
  if (Platform.OS !== 'web') await prepareForPlayback();
  const { locale, identifier } = await chooseVoice(lang);
  if (requestId !== speechRequestId) return;

  if (Platform.OS === 'web') {
    speakBrowser(chunks, locale, identifier, requestId, handlers);
    return;
  }

  // Queueing several browser utterances in the same tick is unreliable: some
  // browsers start the next utterance before the previous one has flushed and
  // cut the current sentence short. Start each sentence only after the prior
  // one reports completion instead.
  const speakNext = (index: number) => {
    if (requestId !== speechRequestId) return;
    const isLast = index === chunks.length - 1;
    Speech.speak(chunks[index], {
      language: locale,
      ...(identifier ? { voice: identifier } : {}),
      rate: RATE,
      pitch: PITCH,
      volume: VOLUME,
      onDone: isLast
        ? () => { if (requestId === speechRequestId) handlers.onDone?.(); }
        : () => speakNext(index + 1),
      // Do not map onStopped to onDone here. Expo's web adapter maps the
      // browser's transient `onpause` event to `speakingStopped`; treating that
      // pause as completion makes Hans restart recognition and interrupt the
      // sentence that is still being spoken. Explicit stop buttons already
      // reset their own UI state, while provider generations ignore callbacks
      // from speech that was intentionally superseded.
      onError: () => { if (requestId === speechRequestId) handlers.onError?.(); },
    });
  };

  speakNext(0);
}

/** Stop immediately and drop anything still queued. */
async function cancelSpeech(): Promise<void> {
  // Throws on web if nothing is speaking; harmless either way.
  try {
    if (Platform.OS === 'web') {
      const synthesis = (globalThis as any).speechSynthesis;
      synthesis?.cancel?.();
      synthesis?.resume?.();
    } else {
      await Speech.stop();
    }
  } catch {
    // no-op
  }
}

export async function stop(): Promise<void> {
  speechRequestId += 1;
  await cancelSpeech();
}
