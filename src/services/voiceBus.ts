/**
 * Small in-process event bus for voice alternatives. Existing button handlers
 * remain untouched; screens simply opt into the same actions when a voice
 * command has been confirmed.
 */
export type VoiceAction =
  | 'startAnalyzing'
  | 'submitReport'
  | 'sendCommunity'
  | 'sendChatbot'
  | 'enterCommunity'
  | 'exitCommunity'
  | 'callHelpline'
  | 'searchVerified'
  | 'searchAll'
  | 'clearSearch'
  | 'checkMessage'
  | 'checkVoice'
  | 'runSearch'
  | 'showNextResults'
  | 'showPreviousResults'
  | 'showOlderMessages'
  | 'toggleAboutScam'
  | 'toggleHowToHandle'
  | 'readCommunityGuidance'
  | 'nextCommunityRoom'
  | 'previousCommunityRoom'
  | 'playAnalysisAudio'
  | 'acceptPrivacyConsent';

type Listener = (action: VoiceAction) => void | boolean;
const listeners = new Set<Listener>();

/** Emit an action and report whether a listener handled it. */
export function emitVoiceAction(action: VoiceAction): boolean {
  let handled = false;
  listeners.forEach((listener) => {
    if (listener(action) === true) handled = true;
  });
  return handled;
}

export function subscribeVoiceActions(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type VoiceDictationTarget = 'chatbot' | 'community' | 'report';
type DictationListener = (text: string, target: VoiceDictationTarget) => void;
const dictationListeners = new Set<DictationListener>();

/** Delivers arbitrary dictated text to the currently active text field. */
export function emitVoiceDictation(text: string, target: VoiceDictationTarget): void {
  dictationListeners.forEach((listener) => listener(text, target));
}

export function subscribeVoiceDictation(listener: DictationListener): () => void {
  dictationListeners.add(listener);
  return () => dictationListeners.delete(listener);
}
