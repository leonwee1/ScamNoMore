import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisResultView } from '../components/AnalysisResultView';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, Muted, SubHeading } from '../components/ui';
import { useI18n } from '../i18n';
import { AnalysisResult } from '../services/analysis';
import { aws } from '../services/aws';
import { pickAudio } from '../services/media';
import { colors, font, radius, spacing } from '../theme';

/**
 * Voice flow (wireframe): upload audio OR record ("say what happened", max 5
 * min) -> Transcribe -> editable transcript -> Bedrock analysis.
 *
 * Uses expo-audio (SDK 54+; expo-av was removed). The recorder is hook-based:
 * useAudioRecorder gives an imperative handle whose .uri is populated after
 * .stop().
 */
export const VoiceAnalysisScreen: React.FC<{ route: any }> = ({ route }) => {
  const { t } = useI18n();
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
      setTranscript(await aws.transcribeAudio(uri));
    } catch {
      setError('Transcription failed. You can also type what happened below.');
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
        setError('Microphone permission denied.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setError('Could not access the microphone.');
    }
  };

  const upload = async () => {
    setError(null);
    const uri = await pickAudio();
    if (!uri) {
      setError('No file selected or permission denied.');
      return;
    }
    await transcribe(uri);
  };

  const analyze = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await aws.analyzeTranscript(transcript));
    } catch {
      setError('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTranscript('');
    setResult(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('home.voice.group')} />

        <Card>
          <SubHeading>
            {mode === 'record' ? t('home.sayWhat') : t('home.uploadAudio')}
          </SubHeading>
          <Muted>{t('analyze.maxDuration')}</Muted>
          {mode === 'record' ? (
            <Button
              title={
                recorderState.isRecording
                  ? '■ Stop recording'
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
            placeholder={busy ? 'Transcribing…' : '…'}
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
        {result ? (
          <Button title={`${t('analyze.checkAnother')} 🎙️`} variant="secondary" onPress={reset} />
        ) : null}
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
