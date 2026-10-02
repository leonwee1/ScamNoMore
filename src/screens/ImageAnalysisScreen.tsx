import React, { useEffect, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisResultView } from '../components/AnalysisResultView';
import { BrandMark } from '../components/BrandMark';
import { useMediaPrivacyConsent } from '../components/MediaPrivacyConsent';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, Muted } from '../components/ui';
import { useI18n } from '../i18n';
import { AnalysisResult } from '../services/analysis';
import { api, MAX_MEDIA_MB } from '../services/api';
import { pickImage, PickedImage } from '../services/media';
import { colors, radius, spacing } from '../theme';
import { subscribeVoiceActions } from '../services/voiceBus';
import { useVoiceAssistant } from '../components/VoiceAssistantProvider';

/** Image analysis flow: take/upload picture -> gpt-4o vision -> scam result. */
export const ImageAnalysisScreen: React.FC<{ route: any }> = ({ route }) => {
  const { t, lang } = useI18n();
  const voice = useVoiceAssistant();
  const mode: 'camera' | 'library' = route.params?.mode ?? 'library';
  const fromVoice = route.params?.fromVoice === true;
  const browserVoicePicker = Platform.OS === 'web' && fromVoice;
  const [image, setImage] = useState<PickedImage | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestConsent, resetConsent, acceptFromVoice, consentDialog } = useMediaPrivacyConsent('image');

  const choose = async () => {
    voice.pause();
    setError(null);
    setResult(null);
    // A browser file input must be opened from a real click/tap. When a voice
    // command brought us here, use the existing upload button as that gesture
    // instead of silently attempting a blocked picker on screen mount.
    // On web, a voice callback cannot open a camera/file chooser because the
    // browser requires a real user activation. The visible Take picture
    // button remains the activation and then requests the camera normally.
    const picked = await pickImage(mode === 'camera');
    if (!picked) {
      setError(t('analyze.noImage'));
      voice.resume();
      return;
    }
    resetConsent();
    setImage(picked);
    voice.resume();
  };

  // Auto-open the picker when the screen mounts.
  useEffect(() => {
    if (!browserVoicePicker) choose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserVoicePicker]);

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
    if (!image) return false;
    requestConsent(analyzeConfirmed);
    return true;
  };

  // Voice commands are an additive alternative to the existing button. The
  // button continues to call the same `analyze` function above.
  useEffect(() => subscribeVoiceActions((action) => {
    if (action === 'startAnalyzing') return analyze();
    return false;
  }), [image, requestConsent]);

  useEffect(() => subscribeVoiceActions((action) => {
    if (action === 'acceptPrivacyConsent') return acceptFromVoice();
    return false;
  }), [acceptFromVoice]);

  // 'bottom' only: the native stack header already clears the status bar, so
  // asking for the top inset here would add a second copy of it.
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={[0]}>
        <ScreenHeader title={t('app.name')} titleIcon={<BrandMark size={34} />} showBack />

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
