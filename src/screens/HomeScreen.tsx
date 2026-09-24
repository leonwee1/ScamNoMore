import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackendBanner } from '../components/BackendBanner';
import { BrandMark } from '../components/BrandMark';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Card, Muted, SubHeading } from '../components/ui';
import { scamStore } from '../data/scamStore';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';

/**
 * Home = the "Please select what to analyze" hub from the wireframe.
 * Five actions grouped into Text / Voice / Video.
 */
export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useI18n();
  const domain = useDomain();
  const { scale } = useTextScale();
  const [storeVersion, setStoreVersion] = useState(0);
  useEffect(() => scamStore.subscribe(() => setStoreVersion((version) => version + 1)), []);
  const latestVerified = useMemo(
    () =>
      scamStore
        .all()
        .filter((record) => record.verified)
        .sort((a, b) => b.dateReported.localeCompare(a.dateReported) || b.id.localeCompare(a.id))
        .slice(0, 2),
    [storeVersion]
  );
  const cautionTextStyle = { fontSize: scaled(font.body, scale), lineHeight: scaled(21, scale) };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={t('app.name')} titleIcon={<BrandMark size={34} />} showControls />
        <BackendBanner />

        {/* Keep the privacy reminder immediately before the user's first
            action, where it is seen before any media is selected. */}
        <View style={styles.cautionBox}>
          <Body style={{ ...cautionTextStyle, color: colors.medium, fontWeight: '800' }}>
            ⚠️ {t('home.cautionTitle')}
          </Body>
          <Body style={cautionTextStyle}>{t('home.caution')}</Body>
        </View>

        <SubHeading>{t('home.prompt')}</SubHeading>

        <Card>
          <Muted style={styles.groupLabel}>{t('home.text.group')}</Muted>
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
          <Muted style={styles.groupLabel}>{t('home.voice.group')}</Muted>
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
          <Muted style={styles.groupLabel}>{t('home.video.group')}</Muted>
          <Button
            title={t('home.uploadVideo')}
            onPress={() => navigation.navigate('VideoAnalysis')}
          />
        </Card>

        <View style={styles.latestSection}>
          <View style={styles.latestHeader}>
            <SubHeading>{t('home.latestVerified')}</SubHeading>
            <Pressable
              onPress={() => navigation.navigate('SearchTab')}
              accessibilityRole="button"
              accessibilityLabel={t('home.viewAllCases')}
              hitSlop={8}
            >
              <Text style={[styles.viewAll, { fontSize: scaled(font.small, scale) }]}>{t('home.viewAllCases')} →</Text>
            </Pressable>
          </View>

          <View style={styles.latestGrid}>
            {latestVerified.map((record) => (
              <View key={record.id} style={styles.latestCase}>
                <Text style={[styles.caseType, { fontSize: scaled(font.small, scale), lineHeight: scaled(18, scale) }]} numberOfLines={2}>
                  {domain.scamType(record.scamType)}
                </Text>
                <Muted numberOfLines={1}>
                  ◷ {record.dateReported} · {domain.town(record.town)}
                </Muted>
                <Muted numberOfLines={1}>⌖ {record.specificPlace}</Muted>
                <View style={styles.caseFooter}>
                  <Muted numberOfLines={1} style={styles.caseKeywords}>
                    {domain.keywords(record.keywords).join(', ')}
                  </Muted>
                  {/^https?:\/\//i.test(record.source) ? (
                    <Pressable
                      onPress={() => Linking.openURL(record.source).catch(() => undefined)}
                      accessibilityRole="link"
                      accessibilityLabel={t('search.readSource')}
                      hitSlop={8}
                    >
                      <Text style={[styles.sourceLink, { fontSize: scaled(11, scale) }]}>{t('search.readSource')} ↗</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
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
  groupLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  latestSection: { gap: spacing.sm },
  latestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  viewAll: { color: colors.primary, fontSize: font.small, fontWeight: '800' },
  latestGrid: { flexDirection: 'column', gap: spacing.sm },
  latestCase: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  caseType: { color: colors.text, fontSize: font.small, fontWeight: '800', lineHeight: 18 },
  caseFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  caseKeywords: { flex: 1 },
  sourceLink: { color: colors.primary, fontSize: 11, fontWeight: '800' },
});
