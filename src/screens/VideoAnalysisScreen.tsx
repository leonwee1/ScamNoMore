import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisResultView } from '../components/AnalysisResultView';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted, SubHeading } from '../components/ui';
import { useI18n } from '../i18n';
import { AnalysisResult } from '../services/analysis';
import { aws } from '../services/aws';
import { pickVideo } from '../services/media';
import { colors, spacing } from '../theme';

/** Video flow: upload video (max 5 min) -> Rekognition Video -> scam result. */
export const VideoAnalysisScreen: React.FC = () => {
  const { t } = useI18n();
  const [uri, setUri] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async () => {
    setError(null);
    setResult(null);
    const picked = await pickVideo();
    if (!picked) {
      setError('No video selected or permission denied.');
      return;
    }
    setUri(picked);
  };

  const analyze = async () => {
    if (!uri) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await aws.analyzeVideo(uri));
    } catch {
      setError('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setUri(null);
    setResult(null);
    setError(null);
    choose();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('home.video.group')} />
        <Card>
          <SubHeading>{t('home.uploadVideo')}</SubHeading>
          <Muted>{t('analyze.maxDuration')}</Muted>
          {uri ? <Body>Selected: {uri.split('/').pop()}</Body> : null}
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
        {result ? (
          <Button title={`${t('analyze.checkAnother')} 🎬`} variant="secondary" onPress={reset} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
});
