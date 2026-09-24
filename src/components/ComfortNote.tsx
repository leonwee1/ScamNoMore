import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';
import { Body } from './ui';

/** Inclusive reporting guidance with a prominent 1799 call action. */
export const ComfortNote: React.FC = () => {
  const { t } = useI18n();
  const { scale } = useTextScale();

  return (
    <View style={styles.wrap}>
      <Body style={styles.title}>{t('report.comfort')}</Body>
      <Body style={styles.supporting}>{t('report.supporting')}</Body>
      <View style={styles.helplineRow}>
        <Body style={styles.helplineText}>
          {t('report.helplinePrompt')}{' '}
          <Text style={styles.helplineLabel}>{t('report.helpline')}</Text>
        </Body>
        <Pressable
          onPress={() => Linking.openURL('tel:1799').catch(() => undefined)}
          accessibilityRole="button"
          accessibilityLabel={t('report.callHelpline')}
          style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
        >
          <Text style={[styles.callText, { fontSize: scaled(font.small, scale) }]}>☎ {t('report.callHelpline')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { color: colors.text, fontWeight: '800' },
  supporting: { color: colors.textMuted },
  helplineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  helplineText: { flex: 1, color: colors.text },
  helplineLabel: { color: colors.primary, fontWeight: '800' },
  callButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonPressed: { opacity: 0.82 },
  callText: { color: colors.white, fontWeight: '800' },
});
