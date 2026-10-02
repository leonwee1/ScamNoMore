import type { NavigationContainerRef } from '@react-navigation/native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useI18n } from '../i18n';
import { TEXT_SCALE_DEFAULT, TEXT_SCALE_MAX, TEXT_SCALE_MIN, TEXT_SCALE_STEP, useTextScale } from '../textScale';
import { speak, stop as stopSpeech } from '../services/speech';
import {
  isWakePhrase,
  extractDictation,
  localeForVoice,
  parseVoiceCommand,
  voiceCommandExamples,
  voiceCopy,
  requiresVoiceConfirmation,
  type VoiceIntent,
} from '../services/voiceCommands';
import { emitVoiceAction, emitVoiceDictation } from '../services/voiceBus';
import { loadSpeechRuntime } from '../services/voiceRuntime';

type VoiceStatus = 'idle' | 'listening' | 'speaking' | 'unavailable';
type VoiceContextValue = {
  status: VoiceStatus;
  active: boolean;
  /** Temporarily release the microphone for an existing camera/audio flow. */
  pause: () => void;
  /** Resume the wake listener after that flow returns. */
  resume: () => void;
};

const VoiceContext = createContext<VoiceContextValue>({ status: 'idle', active: false, pause: () => undefined, resume: () => undefined });
// Keep Hans available for a full minute after the last voice activity.
const SILENCE_TIMEOUT_MS = 60_000;
// Browser speech synthesis can report onDone slightly before the final audio
// has left the speaker. Keep recognition deaf briefly so that tail audio is
// not fed back to Hans as a new (usually unknown) command.
const SPEECH_TAIL_GUARD_MS = 1_200;
const DICTATION_MAX_WORDS = 200;

function isYes(intent: VoiceIntent): boolean {
  return intent?.type === 'session' && intent.target === 'confirm';
}

function isNo(intent: VoiceIntent): boolean {
  return intent?.type === 'session' && intent.target === 'cancel';
}

function normalizeSpeechForComparison(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

function isSpeechEcho(transcript: string, announcement: string): boolean {
  const heard = normalizeSpeechForComparison(transcript);
  const spoken = normalizeSpeechForComparison(announcement);
  if (!heard || !spoken) return false;
  if (heard === spoken) return true;
  // Recognition often returns only part of Hans's last sentence. Treat a
  // meaningful fragment as an echo too, while avoiding short words such as
  // “now” or “the” that could occur in a real command.
  return heard.length >= 8 && (spoken.includes(heard) || heard.includes(spoken));
}

function actionPrompt(target: Extract<VoiceIntent, { type: 'action' }>['target'], lang: 'en' | 'zh' | 'ms' | 'ta'): string {
  const prompts = {
    en: {
      startAnalyzing: 'I can start the analysis.',
      submitReport: 'I can submit your report.',
      sendCommunity: 'I can send your message.',
      enterCommunity: 'I can enter the chat room.',
      exitCommunity: 'I can leave the chat room.',
      callHelpline: 'I can call the 1799 Helpline.',
      runSearch: 'I can apply the search filters.', showNextResults: 'I can show the next cases.', showPreviousResults: 'I can show the previous cases.', showOlderMessages: 'I can load older messages.', toggleAboutScam: 'I can show the scam details.', toggleHowToHandle: 'I can show how to handle it.', readCommunityGuidance: 'I can read the guidance aloud.', nextCommunityRoom: 'I can move to the next chat room.', previousCommunityRoom: 'I can move to the previous chat room.', playAnalysisAudio: 'I can read the analysis result aloud.',
    },
    zh: {
      startAnalyzing: '我可以开始分析。',
      submitReport: '我可以提交您的举报。',
      sendCommunity: '我可以发送您的消息。',
      enterCommunity: '我可以进入聊天室。',
      exitCommunity: '我可以离开聊天室。',
      callHelpline: '我可以拨打1799热线。',
      runSearch: '我可以应用搜索条件。', showNextResults: '我可以显示下一批案件。', showPreviousResults: '我可以显示上一批案件。', showOlderMessages: '我可以加载较早的消息。', toggleAboutScam: '我可以显示诈骗详情。', toggleHowToHandle: '我可以显示处理方法。', readCommunityGuidance: '我可以朗读这些内容。', nextCommunityRoom: '我可以选择下一个聊天室。', previousCommunityRoom: '我可以选择上一个聊天室。', playAnalysisAudio: '我可以朗读分析结果。',
    },
    ms: {
      startAnalyzing: 'Saya boleh mula menganalisis.',
      submitReport: 'Saya boleh menghantar laporan anda.',
      sendCommunity: 'Saya boleh menghantar mesej anda.',
      enterCommunity: 'Saya boleh masuk ke bilik sembang.',
      exitCommunity: 'Saya boleh keluar dari bilik sembang.',
      callHelpline: 'Saya boleh telefon Talian 1799.',
      runSearch: 'Saya boleh gunakan penapis carian.', showNextResults: 'Saya boleh tunjukkan kes seterusnya.', showPreviousResults: 'Saya boleh tunjukkan kes sebelumnya.', showOlderMessages: 'Saya boleh muatkan mesej lama.', toggleAboutScam: 'Saya boleh tunjukkan butiran penipuan.', toggleHowToHandle: 'Saya boleh tunjukkan cara mengendalikannya.', readCommunityGuidance: 'Saya boleh bacakan panduan.', nextCommunityRoom: 'Saya boleh pilih bilik sembang seterusnya.', previousCommunityRoom: 'Saya boleh pilih bilik sembang sebelumnya.', playAnalysisAudio: 'Saya boleh bacakan keputusan analisis.',
    },
    ta: {
      startAnalyzing: 'பகுப்பாய்வைத் தொடங்கலாம்.',
      submitReport: 'உங்கள் புகாரை அனுப்பலாம்.',
      sendCommunity: 'உங்கள் செய்தியை அனுப்பலாம்.',
      enterCommunity: 'அரட்டை அறைக்குள் செல்லலாம்.',
      exitCommunity: 'அரட்டை அறையை விட்டு வெளியேறலாம்.',
      callHelpline: '1799 உதவி எண்ணை அழைக்கலாம்.',
      runSearch: 'தேடல் வடிகட்டிகளைப் பயன்படுத்தலாம்.', showNextResults: 'அடுத்த வழக்குகளைக் காட்டலாம்.', showPreviousResults: 'முந்தைய வழக்குகளைக் காட்டலாம்.', showOlderMessages: 'பழைய செய்திகளை ஏற்றலாம்.', toggleAboutScam: 'மோசடி விவரங்களைக் காட்டலாம்.', toggleHowToHandle: 'எப்படிக் கையாள்வது என்பதைக் காட்டலாம்.', readCommunityGuidance: 'வழிகாட்டியைப் படித்துக் காட்டலாம்.', nextCommunityRoom: 'அடுத்த அரட்டை அறையைத் தேர்வு செய்யலாம்.', previousCommunityRoom: 'முந்தைய அரட்டை அறையைத் தேர்வு செய்யலாம்.', playAnalysisAudio: 'பகுப்பாய்வு முடிவை வாசித்துக் காட்டலாம்.',
    },
  } as const;
  return (prompts[lang] as Record<string, string>)[target] ?? prompts[lang].startAnalyzing;
}

type VoiceResponse = 'done' | 'privacyPrompt' | 'privacyContinued' | 'privacyNotOpen' | 'openingSearch' | 'openingOptions' | 'openingThat' | 'openReport' | 'openCommunity' | 'openChatbot' | 'textBigger' | 'textSmaller' | 'textDefault' | 'languageChanged' | 'dictationEntered' | 'dictationTooLong';

function responseFor(lang: 'en' | 'zh' | 'ms' | 'ta', response: VoiceResponse, detail?: string): string {
  const copy = {
    en: {
      done: 'Done.', privacyPrompt: 'Privacy notice open. Review it, then say: “I understand and continue”.', privacyContinued: 'I understand. I’ll continue with the analysis.', privacyNotOpen: 'Please start an analysis first so I can show the privacy notice.', openingSearch: 'Opening Search.', openingOptions: 'Opening your options.', openingThat: 'Opening that now.', openReport: 'I opened the report page. Please check the details before submitting.', openCommunity: 'I opened Community. Please check your message before sending.', openChatbot: 'Opening Ask Hans.', textBigger: 'The text is bigger now.', textSmaller: 'The text is smaller now.', textDefault: 'The text is back to its default size.', languageChanged: 'I switched to English.', dictationEntered: 'I entered your message. Please review it before sending.', dictationTooLong: 'That is more than 200 words. Please dictate a shorter message.',
    },
    zh: {
      done: '好的，已完成。', privacyPrompt: '隐私说明已打开。请阅读，然后说：“我了解并继续”。', privacyContinued: '我明白了，继续分析。', privacyNotOpen: '请先开始分析，我才能打开隐私说明。', openingSearch: '正在打开搜索。', openingOptions: '正在打开功能选项。', openingThat: '正在打开。', openReport: '我已打开举报页面，请先检查资料再提交。', openCommunity: '我已打开社区，请检查消息后再发送。', openChatbot: '正在打开 Ask Hans。', textBigger: '文字已放大。', textSmaller: '文字已缩小。', textDefault: '文字已恢复默认大小。', languageChanged: '已切换到中文。', dictationEntered: '消息已输入，请检查后再发送。', dictationTooLong: '这段话超过200个词，请说短一点。',
    },
    ms: {
      done: 'Selesai.', privacyPrompt: 'Notis privasi dibuka. Semak dahulu, kemudian sebut: “Saya faham dan teruskan”.', privacyContinued: 'Saya faham. Saya akan teruskan analisis.', privacyNotOpen: 'Sila mulakan analisis dahulu supaya saya boleh membuka notis privasi.', openingSearch: 'Membuka Carian.', openingOptions: 'Membuka pilihan anda.', openingThat: 'Membukanya sekarang.', openReport: 'Saya membuka halaman laporan. Sila semak butiran sebelum menghantar.', openCommunity: 'Saya membuka Komuniti. Sila semak mesej sebelum menghantar.', openChatbot: 'Membuka Ask Hans.', textBigger: 'Teks kini lebih besar.', textSmaller: 'Teks kini lebih kecil.', textDefault: 'Teks kembali ke saiz asal.', languageChanged: 'Saya menukar bahasa.', dictationEntered: 'Mesej telah dimasukkan. Sila semak sebelum menghantar.', dictationTooLong: 'Mesej itu melebihi 200 perkataan. Sila sebut mesej yang lebih pendek.',
    },
    ta: {
      done: 'முடிந்தது.', privacyPrompt: 'தனியுரிமை அறிவிப்பு திறந்துள்ளது. படித்து, “நான் புரிந்துகொண்டு தொடர்கிறேன்” என்று சொல்லுங்கள்.', privacyContinued: 'புரிந்துகொண்டேன். பகுப்பாய்வைத் தொடர்கிறேன்.', privacyNotOpen: 'தனியுரிமை அறிவிப்பைத் திறக்க முதலில் பகுப்பாய்வைத் தொடங்குங்கள்.', openingSearch: 'தேடலைத் திறக்கிறேன்.', openingOptions: 'உங்கள் விருப்பங்களைத் திறக்கிறேன்.', openingThat: 'அதை இப்போது திறக்கிறேன்.', openReport: 'புகார் பக்கத்தைத் திறந்துவிட்டேன். அனுப்புவதற்கு முன் விவரங்களைச் சரிபார்க்கவும்.', openCommunity: 'சமூகத்தைத் திறந்துவிட்டேன். அனுப்புவதற்கு முன் செய்தியைச் சரிபார்க்கவும்.', openChatbot: 'Ask Hans ஐத் திறக்கிறேன்.', textBigger: 'எழுத்து பெரிதாக்கப்பட்டது.', textSmaller: 'எழுத்து சிறிதாக்கப்பட்டது.', textDefault: 'எழுத்து இயல்பு அளவுக்கு மீட்டமைக்கப்பட்டது.', languageChanged: 'மொழி மாற்றப்பட்டது.', dictationEntered: 'செய்தி உள்ளிடப்பட்டது. அனுப்புவதற்கு முன் சரிபார்க்கவும்.', dictationTooLong: 'இந்த செய்தி 200 சொற்களுக்கு மேல் உள்ளது. குறுகிய செய்தியைச் சொல்லுங்கள்.',
    },
  } as const;
  return response === 'languageChanged' && detail ? `${detail}` : copy[lang][response];
}

function navigationForIntent(intent: VoiceIntent, navigationRef: NavigationContainerRef<any>): boolean {
  if (!intent) return false;
  if (intent.type === 'navigate') {
    if (intent.target === 'chatbot') navigationRef.navigate('Chatbot');
    else navigationRef.navigate('Tabs', { screen: `${intent.target[0].toUpperCase()}${intent.target.slice(1)}Tab` });
    return true;
  }
  if (intent.type === 'media') {
    // Mark voice-launched image flows so the web screen can wait for the
    // user's tap before opening a file input. Browsers block file pickers
    // launched from a speech-recognition callback because it is not a user
    // activation; native mobile pickers still open automatically as before.
    if (intent.target === 'imageLibrary') navigationRef.navigate('ImageAnalysis', { mode: 'library', fromVoice: true });
    if (intent.target === 'camera') navigationRef.navigate('ImageAnalysis', { mode: 'camera', fromVoice: true });
    if (intent.target === 'audioUpload') navigationRef.navigate('VoiceAnalysis', { mode: 'upload' });
    if (intent.target === 'audioRecord') navigationRef.navigate('VoiceAnalysis', { mode: 'record' });
    if (intent.target === 'video') navigationRef.navigate('VideoAnalysis');
    return true;
  }
  return false;
}

/** Global, language-aware voice session. Existing buttons remain independent. */
export const VoiceAssistantProvider: React.FC<{
  children: React.ReactNode;
  navigationRef: NavigationContainerRef<any>;
}> = ({ children, navigationRef }) => {
  const { lang, setLang } = useI18n();
  const { scale, setScale } = useTextScale();
  const module = useMemo(loadSpeechRuntime, []);
  const copy = voiceCopy(lang);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [active, setActive] = useState(false);

  const activeRef = useRef(false);
  const shouldListenRef = useRef(true);
  const pausedRef = useRef(false);
  // `pausedRef` is also used briefly while Hans speaks. Keep the durable
  // media-flow pause separate so a language change can restart the listener
  // without stealing the microphone from an image/audio/video recording.
  const manuallyPausedRef = useRef(false);
  const startingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Every timer, speech callback, and restart request captures this token.
  // A later session or language change invalidates older callbacks.
  const generationRef = useRef(0);
  // Some speech engines deliver the final microphone frame after Hans has
  // finished speaking. Ignore that tail so Hans cannot answer himself.
  const suppressRecognitionUntilRef = useRef(0);
  const pendingRef = useRef<Extract<VoiceIntent, { type: 'action' }>['target'] | null>(null);
  const lastTranscriptRef = useRef('');
  const lastAnnouncementRef = useRef(copy.greeting);
  // Text-size updates must not change the recognition subscription. The
  // provider remains mounted while the UI re-renders, so keep the latest
  // setter/value in refs instead of making handleTranscript depend on them.
  const scaleRef = useRef(scale);
  const setScaleRef = useRef(setScale);
  scaleRef.current = scale;
  setScaleRef.current = setScale;
  const langRef = useRef(lang);
  langRef.current = lang;

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const startRecognition = useCallback(() => {
    if (!module || !shouldListenRef.current || pausedRef.current || startingRef.current) return;
    startingRef.current = true;
    try {
      module.start({
        lang: localeForVoice(langRef.current),
        interimResults: true,
        continuous: true,
        maxAlternatives: 3,
        contextualStrings: ['ScamNoMore', 'Hans', '1799', 'one two three', '一二三'],
        requiresOnDeviceRecognition: false,
      });
    } catch {
      startingRef.current = false;
      // SpeechRecognition.stop() completes asynchronously in browsers. A
      // start issued during that tiny transition throws InvalidStateError;
      // treating it as a permanent microphone failure made Listening vanish
      // after Hans spoke. Retry the same generation instead of declaring the
      // runtime unavailable. Permission/service errors arrive through the
      // error event below and are handled there.
      if (shouldListenRef.current && !pausedRef.current) {
        const generation = generationRef.current;
        if (restartRef.current) clearTimeout(restartRef.current);
        restartRef.current = setTimeout(() => {
          if (generation === generationRef.current) startRecognition();
        }, 300);
      }
    }
  }, [module]);

  const scheduleRestart = useCallback((delayMs: number) => {
    const generation = generationRef.current;
    if (restartRef.current) clearTimeout(restartRef.current);
    restartRef.current = setTimeout(() => {
      if (generation !== generationRef.current) return;
      startRecognition();
    }, delayMs);
  }, [startRecognition]);

  const startTimer = useCallback(() => {
    clearTimer();
    const generation = generationRef.current;
    timerRef.current = setTimeout(() => {
      if (generation !== generationRef.current) return;
      if (!activeRef.current || pausedRef.current || manuallyPausedRef.current) return;
      generationRef.current += 1;
      const stopGeneration = generationRef.current;
      activeRef.current = false;
      setActive(false);
      pendingRef.current = null;
      // Allow the same wake phrase to activate a new session. Without this,
      // repeating the phrase after the 60-second timeout was ignored as a
      // duplicate transcript.
      lastTranscriptRef.current = '';
      const currentLang = langRef.current;
      const currentCopy = voiceCopy(currentLang);
      lastAnnouncementRef.current = currentCopy.stopped;
      pausedRef.current = true;
      startingRef.current = false;
      try { module?.stop(); } catch { /* already stopped */ }
      // The visible Listening banner disappears exactly at the 60-second
      // silence limit; Hans may still provide the short spoken sign-off.
      setStatus('idle');
      speak([currentCopy.stopped], currentLang, {
        onDone: () => {
          if (stopGeneration !== generationRef.current) return;
          pausedRef.current = false;
          suppressRecognitionUntilRef.current = Date.now() + SPEECH_TAIL_GUARD_MS;
          setStatus('idle');
          scheduleRestart(250);
        },
        onError: () => {
          if (stopGeneration !== generationRef.current) return;
          pausedRef.current = false;
          suppressRecognitionUntilRef.current = Date.now() + SPEECH_TAIL_GUARD_MS;
          setStatus('idle');
          scheduleRestart(250);
        },
      });
    }, SILENCE_TIMEOUT_MS);
  }, [clearTimer, module, scheduleRestart]);

  const pause = useCallback(() => {
    generationRef.current += 1;
    manuallyPausedRef.current = true;
    clearTimer();
    pausedRef.current = true;
    startingRef.current = false;
    setStatus('idle');
    try { module?.stop(); } catch { /* no active recogniser */ }
  }, [clearTimer, module]);

  const resume = useCallback(() => {
    manuallyPausedRef.current = false;
    pausedRef.current = false;
    if (activeRef.current) {
      suppressRecognitionUntilRef.current = Date.now() + SPEECH_TAIL_GUARD_MS;
      // A new listening turn must be allowed to repeat the same command (for
      // example, “next chat room” or “play audio”). This ref only suppresses
      // duplicate result events from the same recognition turn.
      lastTranscriptRef.current = '';
      setStatus('listening');
      startTimer();
    }
    startRecognition();
  }, [startRecognition, startTimer]);

  const announce = useCallback((message: string, after?: () => void) => {
    // Invalidate every timer/restart callback belonging to the previous
    // recognition turn before we speak. Clearing a timeout alone is not
    // sufficient when its callback has already entered the event queue; a
    // generation bump prevents that stale callback from ending the new turn
    // and saying the inactivity sign-off after a completed action.
    generationRef.current += 1;
    const generation = generationRef.current;
    lastAnnouncementRef.current = message;
    clearTimer();
    pausedRef.current = true;
    // Some recognition runtimes do not emit `end` synchronously after stop().
    // Clear the startup guard here so the post-speech restart is not rejected
    // as “already starting”, especially after an invalid command response.
    startingRef.current = false;
    try { module?.stop(); } catch { /* no active recogniser */ }
    setStatus('speaking');
    speak([message], langRef.current, {
      onDone: () => {
        if (generation !== generationRef.current) return;
        pausedRef.current = false;
        suppressRecognitionUntilRef.current = Date.now() + SPEECH_TAIL_GUARD_MS;
        lastTranscriptRef.current = '';
        after?.();
        if (activeRef.current) {
          setStatus('listening');
          startTimer();
          scheduleRestart(250);
        } else {
          setStatus('idle');
        }
      },
      onError: () => {
        if (generation !== generationRef.current) return;
        pausedRef.current = false;
        suppressRecognitionUntilRef.current = Date.now() + SPEECH_TAIL_GUARD_MS;
        lastTranscriptRef.current = '';
        after?.();
        if (activeRef.current) {
          setStatus('listening');
          startTimer();
          scheduleRestart(250);
        } else {
          setStatus('idle');
        }
      },
    });
  }, [clearTimer, module, scheduleRestart, startTimer]);

  const activate = useCallback(() => {
    generationRef.current += 1;
    activeRef.current = true;
    setActive(true);
    pendingRef.current = null;
    lastTranscriptRef.current = '';
    startTimer();
    announce(copy.greeting);
  }, [announce, copy.greeting, startTimer]);

  const deactivate = useCallback((announceStop = true) => {
    generationRef.current += 1;
    activeRef.current = false;
    setActive(false);
    pendingRef.current = null;
    lastTranscriptRef.current = '';
    manuallyPausedRef.current = false;
    clearTimer();
    pausedRef.current = true;
    startingRef.current = false;
    try { module?.stop(); } catch { /* no active recogniser */ }
    if (announceStop) announce(copy.stopped, startRecognition);
    else {
      pausedRef.current = false;
      setStatus('idle');
      startRecognition();
    }
  }, [announce, clearTimer, copy.stopped, module, startRecognition]);

  const executeAction = useCallback((intent: Extract<VoiceIntent, { type: 'action' }>) => {
    const target = intent.target;
    const route = navigationRef.getCurrentRoute()?.name;
    if (target === 'startAnalyzing' && !['ImageAnalysis', 'VoiceAnalysis', 'VideoAnalysis'].includes(route ?? '')) {
      announce(lang === 'en' ? 'Please open an image, audio, or video first.' : copy.unknown);
      return;
    }
    if (target === 'submitReport' && route !== 'ReportTab') {
      navigationRef.navigate('Tabs', { screen: 'ReportTab' });
      announce(responseFor(lang, 'openReport'));
      return;
    }
    if (target === 'sendCommunity' && route !== 'CommunityTab') {
      if (route === 'Chatbot') {
        emitVoiceAction('sendChatbot');
        announce(responseFor(lang, 'done'));
        return;
      }
      navigationRef.navigate('Tabs', { screen: 'CommunityTab' });
      announce(responseFor(lang, 'openCommunity'));
      return;
    }
    if (target === 'acceptPrivacyConsent') {
      const handled = emitVoiceAction('acceptPrivacyConsent');
      announce(responseFor(lang, handled ? 'privacyContinued' : 'privacyNotOpen'));
      return;
    }
    if (target === 'startAnalyzing') {
      const handled = emitVoiceAction('startAnalyzing');
      announce(responseFor(lang, handled ? 'privacyPrompt' : 'privacyNotOpen'));
      return;
    }
    if (target === 'enterCommunity' && route !== 'CommunityTab') {
      navigationRef.navigate('Tabs', { screen: 'CommunityTab' });
      setTimeout(() => emitVoiceAction('enterCommunity'), 350);
    } else if (target === 'callHelpline') {
      void Linking.openURL('tel:1799').catch(() => undefined);
    } else if (target === 'playAnalysisAudio' || target === 'readCommunityGuidance') {
      // Playback owns the speech channel; a follow-up Hans acknowledgement
      // would immediately stop the requested content again.
      // “Play audio” is contextual: Community reads the selected scam
      // guidance, while an analysis screen reads its Analysis result.
      emitVoiceAction(target === 'playAnalysisAudio' && route === 'CommunityTab' ? 'readCommunityGuidance' : target);
      return;
    } else {
      emitVoiceAction(target);
    }
    announce(responseFor(lang, 'done'));
  }, [announce, copy.greeting, copy.unknown, lang, navigationRef]);

  const handleTranscript = useCallback((transcript: string) => {
    const text = transcript.trim();
    // Speech results can arrive one event late after Hans has already acted.
    // Do not turn that queued tail into a second “I don't understand” reply.
    if (pausedRef.current) return;
    if (!text) return;
    if (Date.now() < suppressRecognitionUntilRef.current) return;
    if (isSpeechEcho(text, lastAnnouncementRef.current)) return;
    if (text === lastTranscriptRef.current) return;
    lastTranscriptRef.current = text;

    if (!activeRef.current) {
      if (isWakePhrase(text, lang)) activate();
      return;
    }

    startTimer();
    const intent = parseVoiceCommand(text, lang);
    if (pendingRef.current) {
      if (isYes(intent)) {
        const target = pendingRef.current;
        pendingRef.current = null;
        executeAction({ type: 'action', target });
      } else if (isNo(intent)) {
        pendingRef.current = null;
        announce(copy.cancelled);
      } else if (intent?.type === 'session' && intent.target === 'stop') {
        pendingRef.current = null;
        deactivate();
      } else {
        announce(copy.confirm);
      }
      return;
    }

    if (!intent) {
      const dictated = extractDictation(text, lang);
      const route = navigationRef.getCurrentRoute()?.name;
      const target = route === 'Chatbot' ? 'chatbot' : route === 'CommunityTab' ? 'community' : route === 'ReportTab' ? 'report' : null;
      if (dictated && target) {
        const words = dictated.split(/\s+/).filter(Boolean);
        if (words.length > DICTATION_MAX_WORDS) {
          announce(responseFor(lang, 'dictationTooLong'));
          return;
        }
        const value = words.join(' ');
        emitVoiceDictation(value, target);
        announce(responseFor(lang, 'dictationEntered'));
        return;
      }
      announce(copy.unknown);
      return;
    }
    if (intent.type === 'session') {
      if (intent.target === 'stop') {
        deactivate();
      } else if (intent.target === 'cancel') {
        announce(copy.cancelled);
      } else if (intent.target === 'repeat') {
        announce(lastAnnouncementRef.current);
      } else if (intent.target === 'help') {
        announce(voiceCommandExamples(lang));
      } else if (intent.target === 'confirm') {
        // “Continue”/“Yes” is also a natural way to answer the privacy
        // dialog, even though it is not a confirmation prompt from Hans.
        const handled = emitVoiceAction('acceptPrivacyConsent');
        announce(handled ? responseFor(lang, 'privacyContinued') : copy.unknown);
      }
      return;
    }
    if (intent.type === 'settings') {
      if (intent.target === 'languageEn' || intent.target === 'languageZh' || intent.target === 'languageMs' || intent.target === 'languageTa') {
        const nextLang = intent.target.replace('language', '').toLowerCase() as 'en' | 'zh' | 'ms' | 'ta';
        // Stop the old-locale recogniser before changing language. Otherwise
        // its final result can be handled by the new locale and produce the
        // spurious “I don't understand” response.
        clearTimer();
        generationRef.current += 1;
        pendingRef.current = null;
        lastTranscriptRef.current = '';
        pausedRef.current = true;
        startingRef.current = false;
        try { module?.stop(); } catch { /* already stopped */ }
        setLang(nextLang);
        setTimeout(() => announce(nextLang === 'zh' ? '已切换到中文。' : nextLang === 'ms' ? 'Bahasa Melayu telah dipilih.' : nextLang === 'ta' ? 'தமிழ் தேர்ந்தெடுக்கப்பட்டது.' : 'English selected.'), 0);
      } else if (intent.target === 'textBigger') {
        setScaleRef.current(scaleRef.current + TEXT_SCALE_STEP);
        announce(responseFor(lang, 'textBigger'));
      } else if (intent.target === 'textSmaller') {
        setScaleRef.current(scaleRef.current - TEXT_SCALE_STEP);
        announce(responseFor(lang, 'textSmaller'));
      } else {
        setScaleRef.current(TEXT_SCALE_DEFAULT);
        announce(responseFor(lang, 'textDefault'));
      }
      return;
    }
    if (intent.type === 'action') {
      // Playing the analysis is already an explicit, non-destructive request;
      // asking for a second confirmation made the voice command appear broken
      // and also allowed the queued transcript to interrupt playback.
      if (!requiresVoiceConfirmation(intent.target)) {
        pendingRef.current = null;
        executeAction(intent);
        return;
      }
      pendingRef.current = intent.target;
      announce(`${actionPrompt(intent.target, lang)} ${copy.confirm}`);
      return;
    }
    if (intent.type === 'search') {
      navigationRef.navigate('Tabs', { screen: 'SearchTab' });
      const searchAction = intent.target === 'verified' ? 'searchVerified' : intent.target === 'all' ? 'searchAll' : 'clearSearch';
      setTimeout(() => emitVoiceAction(searchAction), 350);
      announce(responseFor(lang, 'openingSearch'));
      return;
    }
    if (intent.type === 'home') {
      navigationRef.navigate('Tabs', { screen: 'HomeTab' });
      setTimeout(() => emitVoiceAction(intent.target === 'message' ? 'checkMessage' : 'checkVoice'), 350);
      announce(responseFor(lang, 'openingOptions'));
      return;
    }
    if (navigationForIntent(intent, navigationRef)) {
      const message = responseFor(lang, intent.type === 'navigate' && intent.target === 'chatbot' ? 'openChatbot' : 'openingThat');
      announce(message);
    }
  }, [activate, announce, clearTimer, copy.cancelled, copy.confirm, copy.unknown, deactivate, executeAction, lang, module, navigationRef, setLang, startTimer]);

  useEffect(() => {
    if (!module) {
      setStatus('unavailable');
      return undefined;
    }
    shouldListenRef.current = true;
    pausedRef.current = manuallyPausedRef.current;
    lastTranscriptRef.current = '';
    const subscriptions = [
      module.addListener('start', () => {
        startingRef.current = false;
        if (!activeRef.current && !pausedRef.current) setStatus('idle');
        else if (!pausedRef.current) setStatus('listening');
      }),
      module.addListener('end', () => {
        startingRef.current = false;
        if (shouldListenRef.current && !pausedRef.current) {
          scheduleRestart(250);
        }
      }),
      module.addListener('result', (event: any) => {
        if (!event?.isFinal) return;
        const candidates = (event.results ?? [])
          .map((result: any) => result?.transcript ?? '')
          .filter(Boolean);
        // Browsers can return multiple alternatives. Prefer an alternative
        // that matches a wake phrase or known command before falling back to
        // the first transcript, so a slightly misheard top result does not
        // produce an unnecessary “I did not understand” response.
        const transcript = candidates.find((candidate: string) =>
          activeRef.current ? Boolean(parseVoiceCommand(candidate, lang)) : isWakePhrase(candidate, lang)
        ) ?? candidates[0] ?? '';
        handleTranscript(transcript);
      }),
      module.addListener('error', (event: any) => {
        startingRef.current = false;
        if (event?.error === 'not-allowed' || event?.error === 'language-not-supported' || event?.error === 'service-not-allowed') {
          setStatus('unavailable');
          shouldListenRef.current = false;
          return;
        }
        if (shouldListenRef.current && !pausedRef.current) {
          scheduleRestart(1000);
        }
      }),
    ];

    let cancelled = false;
    void (async () => {
      try {
        const permission = await module.requestPermissionsAsync();
        if (!permission.granted || cancelled) {
          setStatus('unavailable');
          shouldListenRef.current = false;
          return;
        }
        startRecognition();
      } catch {
        setStatus('unavailable');
        shouldListenRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      generationRef.current += 1;
      shouldListenRef.current = false;
      pausedRef.current = true;
      clearTimer();
      if (restartRef.current) clearTimeout(restartRef.current);
      subscriptions.forEach((subscription: any) => subscription?.remove?.());
      try { module.abort(); } catch { /* already gone */ }
      stopSpeech();
    };
  }, [clearTimer, handleTranscript, lang, module, scheduleRestart, startRecognition]);

  const value = useMemo(() => ({ status, active, pause, resume }), [active, pause, resume, status]);
  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
};

export function useVoiceAssistant(): VoiceContextValue {
  return useContext(VoiceContext);
}
