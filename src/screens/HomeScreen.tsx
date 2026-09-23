import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackendBanner } from '../components/BackendBanner';
import { BrandMark } from '../components/BrandMark';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted, SubHeading } from '../components/ui';
import { useI18n } from '../i18n';
import { colors, spacing } from '../theme';

/**
 * Home = the "Please select what to analyze" hub from the wireframe.
 * Five actions grouped into Text / Voice / Video.
 */
export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useI18n();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('app.name')} titleIcon={<BrandMark size={34} />} />
        <BackendBanner />
        <SubHeading>{t('home.prompt')}</SubHeading>

        <Card>
          <Muted>{t('home.text.group')}</Muted>
          <Button
            title={t('home.takePicture')}
            onPress={() => navigation.navigate('ImageAnalysis', { mode: 'camera' })}
          />
          {/* All five options on this screen are equal choices, so they all use
              the primary style. A secondary button reads as "less important",
              which is not true of uploading versus taking a picture. */}
          <Button
            title={t('home.uploadImage')}
            onPress={() => navigation.navigate('ImageAnalysis', { mode: 'library' })}
          />
        </Card>

        <Card>
          <Muted>{t('home.voice.group')}</Muted>
          <Button
            title={t('home.uploadAudio')}
            onPress={() => navigation.navigate('VoiceAnalysis', { mode: 'upload' })}
          />
          <Button
            title={t('home.sayWhat')}
            onPress={() => navigation.navigate('VoiceAnalysis', { mode: 'record' })}
          />
        </Card>

        <Card>
          <Muted>{t('home.video.group')}</Muted>
          <Button
            title={t('home.uploadVideo')}
            onPress={() => navigation.navigate('VideoAnalysis')}
          />
        </Card>

        {/* Styled as a caution rather than a neutral tip, since the whole point
            is that it should catch the eye before the user uploads anything. */}
        <View style={styles.cautionBox}>
          <Body style={styles.cautionTitle}>⚠️ {t('home.cautionTitle')}</Body>
          <Body>{t('home.caution')}</Body>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  cautionBox: {
    backgroundColor: '#3B2A12',
    borderColor: colors.medium,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cautionTitle: { color: colors.medium, fontWeight: '800' },
});
