import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalysisResultView } from '../components/AnalysisResultView';
import { BrandMark } from '../components/BrandMark';
import { useMediaPrivacyConsent } from '../components/MediaPrivacyConsent';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted } from '../components/ui';
import { useI18n } from '../i18n';
import { AnalysisResult } from '../services/analysis';
import { api, MAX_MEDIA_MB } from '../services/api';
import { pickImage, PickedImage } from '../services/media';
import { colors, radius, spacing } from '../theme';
import { subscribeVoiceActions } from '../services/voiceBus';
import { useVoiceAssistant } from '../components/VoiceAssistantProvider';

interface WebCameraCaptureProps {
  onCaptured: (image: PickedImage) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

/**
 * Camera capture for Expo Web. expo-image-picker's web camera path is an
 * HTML file input, so browsers show a file chooser instead of opening the
 * webcam. A real MediaStream keeps the button's user gesture, requests camera
 * permission explicitly, and works on laptop webcams as well as mobile web.
 */
const WebCameraCapture: React.FC<WebCameraCaptureProps> = ({ onCaptured, onCancel, onError }) => {
  const videoRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!mediaDevices?.getUserMedia) {
      onErrorRef.current('Camera access is not available in this browser.');
      return () => undefined;
    }

    mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    }).then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current as HTMLVideoElement | null;
      if (!video) return;
      video.srcObject = stream;
      void video.play().then(() => setReady(true)).catch(() => setReady(true));
    }).catch(() => {
      if (!cancelled) onErrorRef.current('Camera permission was denied or the camera is unavailable.');
    });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current as HTMLVideoElement | null;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCaptured({ uri: canvas.toDataURL('image/jpeg', 0.86), mimeType: 'image/jpeg' });
  };

  return (
    <Card style={styles.cameraCard}>
      {React.createElement('video', {
        ref: videoRef,
        autoPlay: true,
        muted: true,
        playsInline: true,
        style: styles.cameraVideo,
      })}
      <Body style={styles.cameraHint}>
        {ready ? 'Point the camera at the image, then capture it.' : 'Opening camera…'}
      </Body>
      <View style={styles.cameraActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel camera" onPress={onCancel} style={styles.cameraCancel}>
          <Text style={styles.cameraCancelText}>Cancel</Text>
        </Pressable>
        <Button title="Capture" onPress={capture} disabled={!ready} />
      </View>
    </Card>
  );
};

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const { requestConsent, resetConsent, acceptFromVoice, consentDialog } = useMediaPrivacyConsent('image');
  const browserCamera = Platform.OS === 'web' && mode === 'camera';

  const choose = async () => {
    voice.pause();
    setError(null);
    setResult(null);
    if (browserCamera) {
      setCameraOpen(true);
      return;
    }
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

  const onWebCameraCaptured = useCallback((picked: PickedImage) => {
    resetConsent();
    setImage(picked);
    setCameraOpen(false);
    voice.resume();
  }, [resetConsent, voice]);

  const closeWebCamera = useCallback(() => {
    setCameraOpen(false);
    voice.resume();
  }, [voice]);

  const webCameraError = useCallback((message: string) => {
    setCameraOpen(false);
    setError(message);
    voice.resume();
  }, [voice]);

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
          {cameraOpen ? (
            <WebCameraCapture
              onCaptured={onWebCameraCaptured}
              onCancel={closeWebCamera}
              onError={webCameraError}
            />
          ) : null}
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
  cameraCard: { padding: 0, overflow: 'hidden' },
  cameraVideo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#071923' },
  cameraHint: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  cameraActions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, alignItems: 'center' },
  cameraCancel: { minHeight: 44, flex: 1, borderRadius: 11, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cameraCancelText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
