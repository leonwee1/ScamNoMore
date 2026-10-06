import { useHeaderHeight } from '@react-navigation/elements';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, Muted } from '../components/ui';
import { useVoiceAssistant } from '../components/VoiceAssistantProvider';
import { subscribeVoiceActions, subscribeVoiceDictation } from '../services/voiceBus';
import { useI18n } from '../i18n';
import { api, ChatTurn } from '../services/api';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';
import { voiceCopy } from '../services/voiceCommands';

/**
 * Hans may recommend an official source, but only these government/ScamShield
 * hosts are made tappable in the chat. This prevents a model-generated or
 * user-supplied URL from looking like a verified endorsement.
 */
const TRUSTED_SOURCE_HOSTS = new Set([
  'scamshield.gov.sg',
  'www.scamshield.gov.sg',
  'police.gov.sg',
  'www.police.gov.sg',
  'eservices1.police.gov.sg',
]);

const ASSISTANT_LINK_PATTERN = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|https:\/\/[^\s<>"')]+/gi;

const WEB_KEY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
] as const;

const WEB_SYMBOL_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '$', '%', '&', '*', '-', '_', '(', ')'],
  ['?', '!', "'", '"', ':', ';', '/', '+', '=', '…'],
] as const;

/** A compact, optional keyboard for desktop browsers without an OS keyboard. */
const WebChatKeyboard: React.FC<{
  shift: boolean;
  symbols: boolean;
  onShift: () => void;
  onSymbols: () => void;
  onKey: (key: string) => void;
  onFocusInput: () => void;
}> = ({ shift, symbols, onShift, onSymbols, onKey, onFocusInput }) => {
  const rows = symbols ? WEB_SYMBOL_ROWS : WEB_KEY_ROWS;
  return (
  <View style={styles.webKeyboard} accessibilityLabel="On-screen keyboard">
    {rows.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.webKeyboardRow}>
        {rowIndex === 2 && !symbols ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shift"
            onPressIn={onFocusInput}
            onPress={onShift}
            style={[styles.webKeyboardKey, styles.webKeyboardModifier, shift && styles.webKeyboardModifierActive]}
          >
            <Text style={styles.webKeyboardKeyText}>⇧</Text>
          </Pressable>
        ) : null}
        {row.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={shift && !symbols ? key.toUpperCase() : key}
            onPressIn={onFocusInput}
            onPress={() => onKey(shift && !symbols ? key.toUpperCase() : key)}
            style={styles.webKeyboardKey}
          >
            <Text style={styles.webKeyboardKeyText}>{shift && !symbols ? key.toUpperCase() : key}</Text>
          </Pressable>
        ))}
        {rowIndex === 2 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Backspace"
            onPressIn={onFocusInput}
            onPress={() => onKey('backspace')}
            style={[styles.webKeyboardKey, styles.webKeyboardModifier]}
          >
            <Text style={styles.webKeyboardKeyText}>⌫</Text>
          </Pressable>
        ) : null}
      </View>
    ))}
    <View style={styles.webKeyboardRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={symbols ? 'Letters' : 'Numbers and symbols'}
        onPressIn={onFocusInput}
        onPress={onSymbols}
        style={[styles.webKeyboardKey, styles.webKeyboardModifier]}
      >
        <Text style={styles.webKeyboardKeyText}>{symbols ? 'ABC' : '123'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comma"
        onPressIn={onFocusInput}
        onPress={() => onKey(',')}
        style={styles.webKeyboardKey}
      >
        <Text style={styles.webKeyboardKeyText}>,</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Space"
        onPressIn={onFocusInput}
        onPress={() => onKey(' ')}
        style={[styles.webKeyboardKey, styles.webKeyboardSpace]}
      >
        <Text style={styles.webKeyboardKeyText}>space</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Period"
        onPressIn={onFocusInput}
        onPress={() => onKey('.')}
        style={styles.webKeyboardKey}
      >
        <Text style={styles.webKeyboardKeyText}>.</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enter"
        onPressIn={onFocusInput}
        onPress={() => onKey('enter')}
        style={[styles.webKeyboardKey, styles.webKeyboardEnter]}
      >
        <Text style={styles.webKeyboardKeyText}>↵</Text>
      </Pressable>
    </View>
  </View>
  );
};

function isTrustedSourceUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && TRUSTED_SOURCE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Render approved Markdown/https links as real links on web and mobile. */
function renderAssistantMessage(content: string): React.ReactNode {
  const children: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of content.matchAll(ASSISTANT_LINK_PATTERN)) {
    const full = match[0];
    const index = match.index ?? 0;
    const rawUrl = match[2] ?? full;
    const url = rawUrl.replace(/[.,!?;:]+$/, '');
    if (index > cursor) children.push(content.slice(cursor, index));

    if (isTrustedSourceUrl(url)) {
      children.push(
        <Text
          key={`source-${index}`}
          style={styles.sourceLink}
          accessibilityRole="link"
          accessibilityLabel={match[1] ?? url}
          onPress={() => void Linking.openURL(url).catch(() => undefined)}
        >
          {match[1] ?? full}
        </Text>
      );
    } else {
      // Keep an unapproved URL readable but deliberately non-clickable.
      children.push(full);
    }
    cursor = index + full.length;
  }

  if (cursor < content.length) children.push(content.slice(cursor));
  return children;
}

/**
 * OpenAI-powered chatbot for scam Q&A and awareness tips.
 *
 * Questions can be typed or spoken. Spoken questions are transcribed by Whisper
 * into the input box rather than sent straight away, so the user can correct a
 * mis-hearing before it reaches the model.
 */
export const ChatbotScreen: React.FC = () => {
  const { t, lang } = useI18n();
  const { scale } = useTextScale();
  const voice = useVoiceAssistant();
  const voiceText = voiceCopy(lang);
  const headerHeight = useHeaderHeight();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [turns, setTurns] = useState<ChatTurn[]>([
    { role: 'assistant', content: t('chatbot.greeting') },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [webKeyboardVisible, setWebKeyboardVisible] = useState(false);
  const [webKeyboardShift, setWebKeyboardShift] = useState(false);
  const [webKeyboardSymbols, setWebKeyboardSymbols] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const inputRef = useRef<TextInput>(null);
  const keyboardHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Re-translate the opening line when the language changes, but only while the
  // conversation is still untouched — rewriting real history would be wrong.
  useEffect(() => {
    setTurns((cur) =>
      cur.length === 1 && cur[0].role === 'assistant'
        ? [{ role: 'assistant', content: t('chatbot.greeting') }]
        : cur
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const send = async (suggestedMessage?: string) => {
    // Button press callbacks can receive a native/web press event. Only a
    // string is a suggested message; otherwise use the text currently drafted.
    const message = (typeof suggestedMessage === 'string' ? suggestedMessage : draft).trim();
    if (!message || loading) return;
    const next: ChatTurn[] = [...turns, { role: 'user', content: message }];
    setTurns(next);
    setDraft('');
    setNotice(null);
    setLoading(true);
    try {
      // lang tells the model which language to answer in.
      const reply = await api.chat(message, next, lang);
      setTurns((cur) => [...cur, { role: 'assistant', content: reply }]);
    } catch (e) {
      // Surface the real reason (e.g. backend not configured) instead of a
      // canned reply, so a broken setup is never mistaken for a real answer.
      setTurns((cur) => [
        ...cur,
        {
          role: 'assistant',
          content: `⚠️ ${e instanceof Error ? e.message : t('chatbot.error')}`,
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  // The generic “send message” voice command sends the current chatbot draft
  // when Hans is on this screen. Community keeps its existing send button and
  // its separate voice action.
  useEffect(() => subscribeVoiceActions((action) => {
    if (action === 'sendChatbot') void send();
  }), [draft, loading, turns, lang]);

  useEffect(() => subscribeVoiceDictation((text, target) => {
    if (target === 'chatbot') setDraft(text);
  }), []);

  /** Transcribe a finished recording into the input box for review. */
  const transcribe = async (uri: string) => {
    setTranscribing(true);
    setNotice(null);
    try {
      const { text, noSpeechDetected } = await api.transcribeAudio(uri, lang);
      if (noSpeechDetected || !text.trim()) {
        setNotice(t('chatbot.noSpeech'));
        return;
      }
      // Append rather than replace, so a partly typed question is not lost.
      setDraft((cur) => (cur.trim() ? `${cur.trim()} ${text}` : text));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t('analyze.transcribeFailed'));
    } finally {
      setTranscribing(false);
    }
  };

  const toggleRecording = async () => {
    const wasRecording = recorderState.isRecording;
    voice.pause();
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        const uri = recorder.uri;
        if (uri) await transcribe(uri);
        return;
      }
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setNotice(t('analyze.micDenied'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setNotice(null);
    } catch {
      setNotice(t('analyze.micError'));
    } finally {
      // The visible microphone button keeps its existing recording behavior;
      // the global wake listener simply yields the microphone while it runs.
      if (wasRecording) voice.resume();
    }
  };

  const busy = loading || transcribing;

  const focusWebInput = () => {
    if (Platform.OS !== 'web') return;
    if (keyboardHideTimer.current) clearTimeout(keyboardHideTimer.current);
    setWebKeyboardVisible(true);
    inputRef.current?.focus();
  };

  const scheduleWebKeyboardHide = () => {
    if (Platform.OS !== 'web') return;
    // Allow a keyboard key's press event to refocus the textbox before hiding
    // the keyboard when the textbox briefly loses focus on the web.
    keyboardHideTimer.current = setTimeout(() => setWebKeyboardVisible(false), 180);
  };

  const pressWebKey = (key: string) => {
    focusWebInput();
    const start = Math.max(0, Math.min(selection.start, draft.length));
    const end = Math.max(start, Math.min(selection.end, draft.length));
    if (key === 'enter') {
      void send();
      return;
    }
    if (key === 'backspace') {
      if (start !== end) {
        setDraft(`${draft.slice(0, start)}${draft.slice(end)}`);
        setSelection({ start, end: start });
      } else if (start > 0) {
        setDraft(`${draft.slice(0, start - 1)}${draft.slice(end)}`);
        setSelection({ start: start - 1, end: start - 1 });
      }
      return;
    }
    const next = `${draft.slice(0, start)}${key}${draft.slice(end)}`;
    setDraft(next);
    setSelection({ start: start + key.length, end: start + key.length });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Without this the on-screen keyboard covers the input row. The offset
        // accounts for the native stack header, which sits outside this view.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        {voice.status === 'listening' || voice.status === 'speaking' ? (
          <View style={styles.voiceBanner} accessibilityLiveRegion="polite">
            <Text style={[styles.voiceBannerText, { fontSize: scaled(font.small, scale) }]}>🎙️ {voice.status === 'speaking' ? voiceText.speaking : voiceText.listening}</Text>
          </View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {turns.map((turn, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                turn.role === 'user' ? styles.user : styles.assistant,
              ]}
            >
              <Body style={turn.role === 'user' ? { color: colors.white } : undefined}>
                {turn.role === 'assistant' ? renderAssistantMessage(turn.content) : turn.content}
              </Body>
            </View>
          ))}
          {turns.length === 1 && !loading ? (
            <View style={styles.promptSection}>
              <View style={styles.promptList}>
                {[
                  'chatbot.promptScam',
                  'chatbot.promptMessage',
                  'chatbot.promptPaid',
                  'chatbot.promptReport',
                ].map((key) => (
                  <Pressable
                    key={key}
                    style={styles.promptBubble}
                    onPress={() => void send(t(key as Parameters<typeof t>[0]))}
                    accessibilityRole="button"
                    accessibilityLabel={t(key as Parameters<typeof t>[0])}
                  >
                    <Text style={[styles.promptText, { fontSize: scaled(font.small, scale) }]}>
                      {t(key as Parameters<typeof t>[0])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {loading ? <Muted>{t('chatbot.typing')}</Muted> : null}
        </ScrollView>

        {recorderState.isRecording ? <Muted style={styles.status}>{t('chatbot.recording')}</Muted> : null}
        {transcribing ? <Muted style={styles.status}>{t('analyze.transcribing')}</Muted> : null}
        {notice ? <Muted style={styles.statusError}>{notice}</Muted> : null}

        <View style={styles.inputRow}>
          <Pressable
            onPress={toggleRecording}
            disabled={loading || transcribing}
            style={[styles.micBtn, recorderState.isRecording && styles.micBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={
              recorderState.isRecording ? t('analyze.stopRecording') : t('chatbot.askByVoice')
            }
            accessibilityState={{ disabled: busy }}
          >
            <Text style={[styles.micIcon, { fontSize: scaled(20, scale) }]}>{recorderState.isRecording ? '■' : '🎤'}</Text>
          </Pressable>

          <TextInput
            ref={inputRef}
            style={[styles.input, { fontSize: scaled(font.body, scale), lineHeight: scaled(21, scale) }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chatbot.placeholder')}
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
            editable={!transcribing}
            multiline
            onFocus={() => setWebKeyboardVisible(Platform.OS === 'web')}
            onBlur={scheduleWebKeyboardHide}
            onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          />
          <Button
            title={t('chatbot.send')}
            onPress={() => void send()}
            loading={loading}
            disabled={!draft.trim() || transcribing}
            style={{ paddingHorizontal: 18 }}
          />
        </View>
        {webKeyboardVisible ? (
          <WebChatKeyboard
            shift={webKeyboardShift}
            symbols={webKeyboardSymbols}
            onShift={() => setWebKeyboardShift((value) => !value)}
            onSymbols={() => setWebKeyboardSymbols((value) => !value)}
            onKey={pressWebKey}
            onFocusInput={focusWebInput}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  bubble: { borderRadius: radius.md, padding: spacing.md, maxWidth: '88%' },
  user: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  assistant: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  promptSection: { gap: spacing.xs, paddingTop: spacing.xs },
  promptList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  promptBubble: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  promptText: { color: colors.primary, fontWeight: '700' },
  sourceLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  status: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  statusError: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs, color: colors.high },
  voiceBanner: { alignItems: 'center', backgroundColor: colors.primary, paddingVertical: spacing.xs },
  voiceBannerText: { color: colors.white, fontWeight: '800' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  micBtn: {
    width: 48,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: colors.high, borderColor: colors.high },
  micIcon: { fontSize: 20, color: colors.primary },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 14 : 8,
    paddingBottom: Platform.OS === 'ios' ? 14 : 8,
    color: colors.text,
    fontSize: font.body,
    backgroundColor: colors.surfaceAlt,
    minHeight: 48,
    maxHeight: 120,
  },
  webKeyboard: {
    gap: 5,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  webKeyboardRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  webKeyboardKey: {
    minWidth: 27,
    height: 31,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webKeyboardModifier: { minWidth: 39, backgroundColor: colors.surfaceAlt },
  webKeyboardModifierActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  webKeyboardSpace: { flex: 1, maxWidth: 190 },
  webKeyboardEnter: { minWidth: 42, backgroundColor: colors.primary, borderColor: colors.primary },
  webKeyboardKeyText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
