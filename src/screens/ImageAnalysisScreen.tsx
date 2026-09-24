import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisResultView } from '../components/AnalysisResultView';
import { useMediaPrivacyConsent } from '../components/MediaPrivacyConsent';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, Muted } from '../components/ui';
import { useI18n } from '../i18n';
import { AnalysisResult } from '../services/analysis';
import { api, MAX_MEDIA_MB } from '../services/api';
import { pickImage, PickedImage } from '../services/media';
import { colors, radius, spacing } from '../theme';

/** Image analysis flow: take/upload picture -> gpt-4o vision -> scam result. */
export const ImageAnalysisScreen: React.FC<{ route: any }> = ({ route }) => {
  const { t, lang } = useI18n();
  const mode: 'camera' | 'library' = route.params?.mode ?? 'library';
  const [image, setImage] = useState<PickedImage | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestConsent, resetConsent, consentDialog } = useMediaPrivacyConsent('image');

  const choose = async () => {
    setError(null);
    setResult(null);
    const picked = await pickImage(mode === 'camera');
    if (!picked) {
      setError(t('analyze.noImage'));
      return;
    }
    resetConsent();
    setImage(picked);
  };

  // Auto-open the picker when the screen mounts.
  useEffect(() => {
    choose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzeConfirmed = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      // lang tells the model which language to write its reasons/advice in.
      setResult(await api.analyzeImage(image.uri, lang, image.mimeType));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('analyze.failed'));
    } finally {
      setLoading(false);
    }
  };

  const analyze = () => {
    if (!image) return;
    requestConsent(analyzeConfirmed);
  };

  // 'bottom' only: the native stack header already clears the status bar, so
  // asking for the top inset here would add a second copy of it.
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* No title: the stack header above already names this screen. */}
        <ScreenHeader />

        <Card>
          {/* The group name now lives in the stack header, so repeating it here
              would be a third copy of the same words. */}
          <Muted>{t('analyze.imageLimits', { size: MAX_MEDIA_MB })}</Muted>
          {image ? <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" /> : null}
          <Button
            title={mode === 'camera' ? t('home.takePicture') : t('home.uploadImage')}
            variant="secondary"
            onPress={choose}
          />
          <Button
            title={t('analyze.startAnalyzing')}
            onPress={analyze}
            loading={loading}
            disabled={!image}
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
  preview: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
});
