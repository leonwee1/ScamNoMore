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
import { useI18n } from '../i18n';
import { api, ChatTurn } from '../services/api';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';

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
    const message = (suggestedMessage ?? draft).trim();
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
    }
  };

  const busy = loading || transcribing;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Without this the on-screen keyboard covers the input row. The offset
        // accounts for the native stack header, which sits outside this view.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
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
                {turn.content}
              </Body>
            </View>
          ))}
          {turns.length === 1 && !loading ? (
            <View style={styles.promptSection}>
              <Muted>{t('chatbot.commonQuestions')}</Muted>
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
            style={[styles.input, { fontSize: scaled(font.body, scale), lineHeight: scaled(21, scale) }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chatbot.placeholder')}
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
            editable={!transcribing}
            multiline
          />
          <Button
            title={t('chatbot.send')}
            onPress={send}
            loading={loading}
            disabled={!draft.trim() || transcribing}
            style={{ paddingHorizontal: 18 }}
          />
        </View>
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
  status: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  statusError: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs, color: colors.high },
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
});
