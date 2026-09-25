import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackendBanner } from '../components/BackendBanner';
import { BrandMark } from '../components/BrandMark';
import { ScreenHeader } from '../components/ScreenHeader';
import { Body, Button, Heading, Muted, SubHeading } from '../components/ui';
import { scamStore } from '../data/scamStore';
import { useI18n } from '../i18n';
import { useDomain } from '../i18n/useDomain';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';
import { daysAgo, deviceToday, singaporeGreetingPeriod } from '../services/dates';

type ActionGroup = 'text' | 'voice' | 'video';

/**
 * Home = the "Please select what to analyze" hub from the wireframe.
 * Five actions grouped into Text / Voice / Video.
 */
export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useI18n();
  const domain = useDomain();
  const { scale } = useTextScale();
  const [expandedGroup, setExpandedGroup] = useState<ActionGroup | null>(null);
  const [storeVersion, setStoreVersion] = useState(0);
  useEffect(() => scamStore.subscribe(() => setStoreVersion((version) => version + 1)), []);
  const today = deviceToday();
  const latestCaseCutoff = daysAgo(1);
  const latestVerified = useMemo(
    () =>
      scamStore
        .all()
        .filter((record) => record.verified && record.dateReported <= latestCaseCutoff)
        .sort((a, b) => b.dateReported.localeCompare(a.dateReported) || b.id.localeCompare(a.id))
        .slice(0, 2),
    [storeVersion, latestCaseCutoff]
  );
  const cautionTextStyle = { fontSize: scaled(font.body, scale), lineHeight: scaled(21, scale) };
  const greeting = t(`home.greeting.${singaporeGreetingPeriod()}`);

  const toggleGroup = (group: ActionGroup) => {
    setExpandedGroup((current) => (current === group ? null : group));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={[0]}>
        <ScreenHeader title={t('app.name')} titleIcon={<BrandMark size={34} />} showControls chatLabel="Ask Hans" />
        <BackendBanner />

        <View style={styles.hero}>
          <Text style={[styles.heroEyebrow, { fontSize: scaled(font.small, scale), lineHeight: scaled(18, scale) }]}>{greeting} · {today}</Text>
          <Heading style={{ ...styles.heroTitle, fontSize: scaled(25, scale), lineHeight: scaled(30, scale) }}>{t('home.heroTitle')}</Heading>
          <Text style={[styles.heroSubtitle, { fontSize: scaled(font.small, scale), lineHeight: scaled(17, scale) }]}>{t('home.heroSubtitle')}</Text>
        </View>

        {/* Keep the privacy reminder before the first action. It is compact so
            it does not overwhelm the clearer three-row action layout. */}
        <View style={styles.cautionBox}>
          <Body style={{ ...cautionTextStyle, color: '#9B6514', fontWeight: '800' }}>
            ⚠️ {t('home.cautionTitle')}
          </Body>
          <Body style={{ ...cautionTextStyle, color: colors.text }}>{t('home.caution')}</Body>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <SubHeading style={styles.sectionHeading}>{t('home.prompt')}</SubHeading>
          </View>

          <View style={styles.actionPanel}>
          <Pressable
            style={styles.actionRow}
            onPress={() => toggleGroup('text')}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedGroup === 'text' }}
          >
            <View style={styles.actionIcon}><Text style={styles.actionIconText}>▤</Text></View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { fontSize: scaled(16, scale), lineHeight: scaled(21, scale) }]}>{t('home.checkMessage')}</Text>
              <Muted style={{ ...styles.actionHint, fontSize: scaled(font.body, scale), lineHeight: scaled(20, scale) }}>{t('home.checkMessageHint')}</Muted>
            </View>
            <Text style={[styles.actionChevron, { fontSize: scaled(22, scale) }]}>{expandedGroup === 'text' ? '⌃' : '›'}</Text>
          </Pressable>
          {expandedGroup === 'text' ? (
            <View style={styles.quickActions}>
              <Button title={t('home.takePicture')} onPress={() => navigation.navigate('ImageAnalysis', { mode: 'camera' })} style={styles.quickButton} />
              <Button title={t('home.uploadImage')} onPress={() => navigation.navigate('ImageAnalysis', { mode: 'library' })} style={styles.quickButton} />
            </View>
          ) : null}

          <Pressable
            style={styles.actionRow}
            onPress={() => toggleGroup('voice')}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedGroup === 'voice' }}
          >
            <View style={styles.actionIcon}><Text style={styles.actionIconText}>♪</Text></View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { fontSize: scaled(16, scale), lineHeight: scaled(21, scale) }]}>{t('home.checkVoice')}</Text>
              <Muted style={{ ...styles.actionHint, fontSize: scaled(font.body, scale), lineHeight: scaled(20, scale) }}>{t('home.checkVoiceHint')}</Muted>
            </View>
            <Text style={[styles.actionChevron, { fontSize: scaled(22, scale) }]}>{expandedGroup === 'voice' ? '⌃' : '›'}</Text>
          </Pressable>
          {expandedGroup === 'voice' ? (
            <View style={styles.quickActions}>
              <Button title={t('home.uploadAudio')} onPress={() => navigation.navigate('VoiceAnalysis', { mode: 'upload' })} style={styles.quickButton} />
              <Button title={t('home.sayWhat')} onPress={() => navigation.navigate('VoiceAnalysis', { mode: 'record' })} style={styles.quickButton} />
            </View>
          ) : null}

          <Pressable
            style={[styles.actionRow, styles.actionRowLast]}
            onPress={() => navigation.navigate('VideoAnalysis')}
            accessibilityRole="button"
          >
            <View style={styles.actionIcon}><Text style={styles.actionIconText}>▣</Text></View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { fontSize: scaled(16, scale), lineHeight: scaled(21, scale) }]}>{t('home.checkVideo')}</Text>
              <Muted style={{ ...styles.actionHint, fontSize: scaled(font.body, scale), lineHeight: scaled(20, scale) }}>{t('home.checkVideoHint')}</Muted>
            </View>
            <Text style={[styles.actionChevron, { fontSize: scaled(22, scale) }]}>›</Text>
          </Pressable>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeadingRow}>
            <SubHeading style={styles.sectionHeading}>{t('home.latestVerified')}</SubHeading>
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
                  ◷ {record.dateReported} · {domain.town(record.town)} · {record.specificPlace}
                </Muted>
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
  hero: {
    backgroundColor: '#0F918F',
    borderRadius: 22,
    padding: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  heroEyebrow: {
    color: '#D8FFFA',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 25,
    lineHeight: 30,
    marginTop: spacing.xs,
  },
  heroSubtitle: { color: '#E8FFFB', fontSize: 13, marginTop: spacing.xs },
  cautionBox: {
    backgroundColor: '#FFF6E2',
    borderColor: '#DCA548',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cautionTitle: { color: colors.medium, fontWeight: '800' },
  actionPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    shadowColor: '#123C4A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  actionRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionRowLast: { borderBottomWidth: 0 },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  actionIconText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  actionHint: { fontSize: 15, lineHeight: 20, marginTop: 2 },
  actionChevron: { color: colors.primary, fontSize: 22, paddingHorizontal: spacing.xs },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  quickButton: { flex: 1, minHeight: 40, paddingHorizontal: spacing.sm },
  sectionBlock: { gap: spacing.sm },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionHeading: { lineHeight: 24 },
  viewAll: { color: colors.primary, fontSize: font.small, fontWeight: '800' },
  latestGrid: { flexDirection: 'column', gap: spacing.sm },
  latestCase: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  caseType: { color: colors.text, fontSize: font.small, fontWeight: '800', lineHeight: 18 },
  caseFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  caseKeywords: { flex: 1 },
  sourceLink: { color: colors.primary, fontSize: 11, fontWeight: '800' },
});
