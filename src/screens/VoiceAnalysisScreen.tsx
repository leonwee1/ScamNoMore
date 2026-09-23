import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisResultView } from '../components/AnalysisResultView';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, Muted, SubHeading } from '../components/ui';
import { useI18n } from '../i18n';
import { AnalysisResult } from '../services/analysis';
import { api, MAX_MEDIA_MB } from '../services/api';
import { pickAudio } from '../services/media';
import { colors, font, radius, spacing } from '../theme';

/**
 * Voice flow (wireframe): upload audio OR record ("say what happened", max 5
 * min) -> Whisper -> editable transcript -> gpt-4o analysis.
 *
 * Uses expo-audio (SDK 54+; expo-av was removed). The recorder is hook-based:
 * useAudioRecorder gives an imperative handle whose .uri is populated after
 * .stop().
 */
export const VoiceAnalysisScreen: React.FC<{ route: any }> = ({ route }) => {
  const { t, lang } = useI18n();
  const mode: 'record' | 'upload' = route.params?.mode ?? 'record';

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcribe = async (uri: string) => {
    setBusy(true);
    setError(null);
    try {
      // Pass the selected UI language so Whisper decodes in that language.
      // Left to auto-detect it judges from roughly the first 30 seconds and
      // returns Malay text for short or accented English.
      const { text, noSpeechDetected } = await api.transcribeAudio(uri, lang);
      setTranscript(text);
      if (noSpeechDetected) {
        // Say so plainly. Whisper invents fluent text for silent audio, so an
        // empty transcript here is the honest result, not a failure to explain.
        setError(`${t('analyze.noSpeech.reason')} ${t('analyze.noSpeech.adviceVoice')}`);
      }
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : t('analyze.transcribeFailed')} ${t('analyze.orTypeBelow')}`
      );
    } finally {
      setBusy(false);
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
        setError(t('analyze.micDenied'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setError(t('analyze.micError'));
    }
  };

  const upload = async () => {
    setError(null);
    const uri = await pickAudio();
    if (!uri) {
      setError(t('analyze.noAudio'));
      return;
    }
    await transcribe(uri);
  };

  // In upload mode, open the file picker straight away — the user already chose
  // "Upload audio file" on Home, so tapping the same label again is a wasted
  // step. Recording is left deliberate: it should never start on its own.
  useEffect(() => {
    if (mode === 'upload') upload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyze = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // lang tells the model which language to write its reasons/advice in.
      setResult(await api.analyzeTranscript(transcript, lang));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('analyze.failed'));
    } finally {
      setLoading(false);
    }
  };

  // 'bottom' only: the native stack header already clears the status bar, so
  // asking for the top inset here would add a second copy of it.
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* No title: the stack header above already names this screen. */}
        <ScreenHeader />

        <Card>
          <SubHeading>
            {mode === 'record' ? t('home.sayWhat') : t('home.uploadAudio')}
          </SubHeading>
          {/* Only meaningful when the user is choosing an existing file. When
              recording in-app there is nothing to pick, and the app controls the
              format and length itself. */}
          {mode === 'upload' ? (
            <Muted>{t('analyze.audioLimits', { size: MAX_MEDIA_MB })}</Muted>
          ) : null}
          {mode === 'record' ? (
            <Button
              title={
                recorderState.isRecording
                  ? `■ ${t('analyze.stopRecording')}`
                  : `● ${t('analyze.startRecording')}`
              }
              onPress={toggleRecording}
            />
          ) : (
            <Button title={t('home.uploadAudio')} onPress={upload} />
          )}
        </Card>

        <Card>
          <Muted>{t('analyze.transcribed')}</Muted>
          <TextInput
            style={styles.input}
            multiline
            value={transcript}
            onChangeText={setTranscript}
            placeholder={busy ? t('analyze.transcribing') : '…'}
            placeholderTextColor={colors.textMuted}
            editable={!busy}
          />
          <Button
            title={t('analyze.startAnalyzing')}
            onPress={analyze}
            loading={loading}
            disabled={!transcript.trim() || busy}
          />
        </Card>

        {error ? <Muted style={{ color: colors.high }}>{error}</Muted> : null}
        {result ? <AnalysisResultView result={result} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: font.body,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceAlt,
  },
});
