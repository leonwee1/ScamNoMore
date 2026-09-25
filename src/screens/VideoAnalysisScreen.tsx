import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisResultView } from '../components/AnalysisResultView';
import { BrandMark } from '../components/BrandMark';
import { useMediaPrivacyConsent } from '../components/MediaPrivacyConsent';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted } from '../components/ui';
import { useI18n } from '../i18n';
import { AnalysisResult, unableToAssessResult } from '../services/analysis';
import { api, MAX_MEDIA_MB } from '../services/api';
import { pickVideo } from '../services/media';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';

/**
 * Video flow, laid out to match the audio screen: pick a file, the spoken audio
 * is transcribed into an editable box, then that transcript is analysed.
 *
 * Transcribing first is what makes the verdict auditable. The user can see
 * exactly what Whisper heard before anything is judged, and can correct a
 * mis-heard word — which matters because a silent or noisy clip can otherwise
 * produce a confident-looking result built on nothing.
 */
export const VideoAnalysisScreen: React.FC = () => {
  const { t, lang } = useI18n();
  const { scale } = useTextScale();
  const [uri, setUri] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestConsent, resetConsent, consentDialog } = useMediaPrivacyConsent('video');

  /** Whisper on the video's audio track, into the editable box. */
  const transcribe = async (videoUri: string) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { text, noSpeechDetected } = await api.transcribeVideo(videoUri, lang);
      setTranscript(text);
      if (noSpeechDetected) {
        setResult(unableToAssessResult('video', 'no-speech'));
      }
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : t('analyze.transcribeFailed')} ${t('analyze.orTypeBelow')}`
      );
    } finally {
      setBusy(false);
    }
  };

  const requestTranscription = (videoUri: string, forceConsent = false) => {
    requestConsent(() => transcribe(videoUri), forceConsent);
  };

  const choose = async () => {
    setError(null);
    setResult(null);
    setTranscript('');
    const picked = await pickVideo();
    if (!picked) {
      setError(t('analyze.noVideo'));
      return;
    }
    resetConsent();
    setUri(picked);
    requestTranscription(picked, true);
  };

  // Open the picker straight away: the user already chose "Upload video file" on
  // Home, so making them tap the same label again here is a wasted step.
  useEffect(() => {
    choose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzeConfirmed = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // source 'video' keeps the prompt's evidence type accurate, and sending
      // only the text avoids re-uploading and re-transcribing the whole file.
      setResult(await api.analyzeTranscript(transcript, lang, 'video'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('analyze.failed'));
    } finally {
      setLoading(false);
    }
  };

  const analyze = () => {
    if (!transcript.trim()) return;
    requestConsent(analyzeConfirmed);
  };

  // 'bottom' only: the native stack header already clears the status bar, so
  // asking for the top inset here would add a second copy of it.
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={[0]}>
        <ScreenHeader title={t('app.name')} titleIcon={<BrandMark size={34} />} showBack />

        <Card>
          <Muted>{t('analyze.videoLimits', { size: MAX_MEDIA_MB })}</Muted>
          {uri ? <Body>{t('analyze.selected', { name: uri.split('/').pop() ?? '' })}</Body> : null}
          <Button title={t('home.uploadVideo')} onPress={choose} />
        </Card>

        <Card>
          <Muted>{t('analyze.transcribed')}</Muted>
          <TextInput
            style={[styles.input, { fontSize: scaled(16, scale), lineHeight: scaled(23, scale) }]}
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
      {consentDialog}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  // Matches the transcript box on the voice screen.
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceAlt,
  },
});
