import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackendBanner } from '../components/BackendBanner';
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
        <ScreenHeader title={t('app.name')} />
        <BackendBanner />
        <SubHeading>{t('home.prompt')}</SubHeading>

        <Card>
          <Muted>{t('home.text.group')}</Muted>
          <Button
            title={t('home.takePicture')}
            onPress={() => navigation.navigate('ImageAnalysis', { mode: 'camera' })}
          />
          <Button
            title={t('home.uploadImage')}
            variant="secondary"
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
            variant="secondary"
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

        <View style={styles.tipBox}>
          <Body>{t('home.tip')}</Body>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  tipBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: spacing.md,
  },
});
