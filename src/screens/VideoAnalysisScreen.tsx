import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisResultView } from '../components/AnalysisResultView';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted, SubHeading } from '../components/ui';
import { useI18n } from '../i18n';
import { AnalysisResult } from '../services/analysis';
import { api } from '../services/api';
import { pickVideo } from '../services/media';
import { colors, spacing } from '../theme';

/** Video flow: upload video -> Whisper (audio track) -> gpt-4o -> scam result. */
export const VideoAnalysisScreen: React.FC = () => {
  const { t, lang } = useI18n();
  const [uri, setUri] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async () => {
    setError(null);
    setResult(null);
    const picked = await pickVideo();
    if (!picked) {
      setError(t('analyze.noVideo'));
      return;
    }
    setUri(picked);
  };

  const analyze = async () => {
    if (!uri) return;
    setLoading(true);
    setError(null);
    try {
      // lang drives BOTH Whisper's decoding of the audio track and the language
      // the model writes its reasons/advice in.
      setResult(await api.analyzeVideo(uri, lang));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('analyze.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('home.video.group')} />
        <Card>
          <SubHeading>{t('home.uploadVideo')}</SubHeading>
          <Muted>{t('analyze.maxDuration')}</Muted>
          {uri ? <Body>{t('analyze.selected', { name: uri.split('/').pop() ?? '' })}</Body> : null}
          <Button title={t('home.uploadVideo')} variant="secondary" onPress={choose} />
          <Button
            title={t('analyze.startAnalyzing')}
            onPress={analyze}
            loading={loading}
            disabled={!uri}
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
});
