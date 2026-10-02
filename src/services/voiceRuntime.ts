import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

declare const require: any;

type Listener = (event: any) => void;
type Subscription = { remove: () => void };

export type SpeechRuntime = {
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  addListener: (eventName: string, listener: Listener) => Subscription;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
};

/**
 * The Expo Go binary does not contain ExpoSpeechRecognition. Checking for the
 * optional native module before requiring the package is important: the
 * package's top-level export calls requireNativeModule and would otherwise
 * crash Expo Go before the provider can handle the missing capability.
 *
 * A custom development build that includes the config plugin exposes the
 * optional module, so the native implementation remains available there.
 */
function loadNativeRuntime(): SpeechRuntime | null {
  // Keep native wake-word listening off in Expo Go even if a future Expo Go
  // release happens to expose a similarly named module. A custom development
  // build can still opt in because isRunningInExpoGo() is false there.
  if (isRunningInExpoGo()) return null;
  const nativeModule = requireOptionalNativeModule('ExpoSpeechRecognition');
  if (!nativeModule) return null;

  try {
    return require('expo-speech-recognition').ExpoSpeechRecognitionModule as SpeechRuntime;
  } catch {
    return null;
  }
}

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((event: any) => void) | null;
  onend: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
};

/**
 * Browser speech services do not consistently support the Singapore English
 * locale used by the native recogniser.  In particular, Chrome commonly
 * rejects `en-SG` with `language-not-supported`, which made the Listening
 * indicator disappear after switching language.  Keep the user's language,
 * but use a broadly supported browser locale for recognition.
 */
const BROWSER_LOCALES: Record<string, string> = {
  'en-SG': 'en-US',
  'zh-CN': 'zh-CN',
  'ms-MY': 'ms-MY',
  'ta-IN': 'ta-IN',
};

function browserLocale(locale: string): string {
  return BROWSER_LOCALES[locale] ?? locale;
}

function browserFallbackLocale(locale: string): string | null {
  const base = locale.split('-')[0];
  if (base === locale) return null;
  return base;
}

/**
 * Small adapter around the browser Web Speech API. It deliberately does not
 * import expo-speech-recognition, so the web demo can run without native
 * modules and the native Expo Go bundle never evaluates that package.
 */
function createBrowserRuntime(): SpeechRuntime | null {
  const root = globalThis as any;
  const Recognition = root.window?.SpeechRecognition ?? root.window?.webkitSpeechRecognition;
  if (!Recognition) return null;

  const recognition = new Recognition() as BrowserRecognition;
  const listeners = new Map<string, Set<Listener>>();
  let requestedLocale = 'en-US';
  let fallbackLocaleUsed: string | null = null;
  let attemptedFallback = false;
  const emit = (eventName: string, event: any = {}) => {
    listeners.get(eventName)?.forEach((listener) => listener(event));
  };

  recognition.onstart = () => emit('start');
  recognition.onend = () => emit('end');
  recognition.onerror = (event) => {
    // Some browser speech services reject a regional locale even though they
    // support the language. Retry once with its base language before telling
    // the provider that the microphone is unavailable.
    if (event?.error === 'language-not-supported' && !attemptedFallback) {
      const fallback = browserFallbackLocale(requestedLocale);
      if (fallback) {
        attemptedFallback = true;
        fallbackLocaleUsed = fallback;
        recognition.lang = fallback;
        try {
          recognition.start();
          return;
        } catch {
          // Let the normal error path report the failure if restart is rejected.
        }
      }
    }
    emit('error', event);
  };
  recognition.onresult = (event) => {
    const result = event.results?.[event.resultIndex ?? 0];
    const transcripts = Array.from(result ?? [])
      .map((candidate: any) => candidate?.transcript ?? '')
      .filter(Boolean);
    emit('result', {
      isFinal: Boolean(result?.isFinal ?? event.isFinal),
      results: transcripts.map((transcript) => ({ transcript })),
    });
  };

  return {
    start(options) {
      const nextLocale = browserLocale(String(options.lang ?? 'en-SG'));
      if (nextLocale !== requestedLocale) fallbackLocaleUsed = null;
      requestedLocale = nextLocale;
      attemptedFallback = false;
      recognition.lang = fallbackLocaleUsed ?? requestedLocale;
      recognition.interimResults = Boolean(options.interimResults);
      recognition.continuous = Boolean(options.continuous);
      recognition.maxAlternatives = Number(options.maxAlternatives ?? 1);
      recognition.start();
    },
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
    addListener(eventName, listener) {
      const eventListeners = listeners.get(eventName) ?? new Set<Listener>();
      eventListeners.add(listener);
      listeners.set(eventName, eventListeners);
      return {
        remove: () => eventListeners.delete(listener),
      };
    },
    async requestPermissionsAsync() {
      // SpeechRecognition requests the microphone itself. This probe gives the
      // user a clear browser permission prompt before recognition starts and
      // immediately releases the temporary stream afterward.
      try {
        const stream = await root.navigator?.mediaDevices?.getUserMedia?.({ audio: true });
        stream?.getTracks?.().forEach((track: any) => track.stop());
        return { granted: true };
      } catch {
        return { granted: false };
      }
    },
  };
}

export function loadSpeechRuntime(): SpeechRuntime | null {
  if (Platform.OS === 'web') return createBrowserRuntime();
  return loadNativeRuntime();
}
