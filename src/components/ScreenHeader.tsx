import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGS, useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';

/**
 * Global header shown on every screen: the language switcher (4 local languages)
 * and the Chatbot button that the wireframe places on every screen. Both sit on
 * one row so the controls occupy a single line.
 *
 * `title` is OPTIONAL and should be omitted on any screen that already has a
 * native navigation header. Those screens were rendering the same text twice,
 * once in the stack header and again here.
 */
export const ScreenHeader: React.FC<{
  title?: string;
  /** Rendered immediately before the title, e.g. the app's logo on Home. */
  titleIcon?: React.ReactNode;
}> = ({ title, titleIcon }) => {
  const { lang, setLang, t } = useI18n();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.wrap}>
      <View style={styles.controlsRow}>
        <View style={styles.langRow}>
          {LANGS.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => setLang(l.code)}
              style={[styles.lang, lang === l.code && styles.langActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: lang === l.code }}
            >
              <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
                {l.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => navigation.navigate('Chatbot')}
          style={styles.chatBtn}
          accessibilityRole="button"
          accessibilityLabel={t('chatbot.title')}
        >
          <Text style={styles.chatText}>💬 {t('chatbot.title')}</Text>
        </Pressable>
      </View>

      {title ? (
        <View style={styles.titleRow}>
          {titleIcon}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.md },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Narrow screens with long language labels wrap rather than clip.
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // flexShrink lets a long translated title wrap/ellipsise instead of pushing
  // the logo off screen.
  title: { color: colors.text, fontSize: font.h1, fontWeight: '800', flexShrink: 1 },
  chatBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatText: { color: colors.primary, fontWeight: '700', fontSize: font.small },
  langRow: { flexDirection: 'row', gap: spacing.xs, flexShrink: 1 },
  lang: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  langTextActive: { color: colors.white },
});
