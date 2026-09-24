import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextSizeSlider } from './TextSizeSlider';
import { LANGS, useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';

/**
 * Shared header with a Chatbot shortcut. The Home screen additionally opts into
 * the compact utility strip (language selector + text-size slider) below the
 * brand row. Other screens intentionally show only the Chatbot shortcut.
 *
 * `title` is OPTIONAL and should be omitted on any screen that already has a
 * native navigation header. Those screens were rendering the same text twice,
 * once in the stack header and again here.
 */
export const ScreenHeader: React.FC<{
  title?: string;
  /** Rendered immediately before the title, e.g. the app's logo on Home. */
  titleIcon?: React.ReactNode;
  /** Home opts into the language and text-size utility strip. */
  showControls?: boolean;
  /** Optional label override used by the Home shortcut. */
  chatLabel?: string;
}> = ({ title, titleIcon, showControls = false, chatLabel }) => {
  const { lang, setLang, t } = useI18n();
  const { scale } = useTextScale();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <View style={styles.brandTitle}>
          {titleIcon}
          {title ? (
            <Text style={[styles.title, { fontSize: scaled(font.h1, scale) }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => navigation.navigate('Chatbot')}
          style={styles.chatBtn}
          accessibilityRole="button"
          accessibilityLabel={t('chatbot.title')}
        >
          <Text style={[styles.chatText, { fontSize: scaled(font.small, scale) }]}>✦ {chatLabel ?? t('chatbot.title')}</Text>
        </Pressable>
      </View>

      {showControls ? (
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
                <Text
                  style={[
                    styles.langText,
                    { fontSize: scaled(font.small, scale) },
                    lang === l.code && styles.langTextActive,
                  ]}
                >
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextSizeSlider dark />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, overflow: 'visible' },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#0C2233',
    // Keep the compact slider on the same line as all four language buttons.
    flexWrap: 'nowrap',
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  brandTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  // flexShrink lets a long translated title wrap/ellipsise instead of pushing
  // the logo off screen.
  title: { color: colors.text, fontSize: font.h1, fontWeight: '800', flexShrink: 1 },
  chatBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    minHeight: 44,
    paddingVertical: 10,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatText: { color: colors.primary, fontWeight: '700', fontSize: font.small },
  langRow: { flexDirection: 'row', gap: spacing.xs, flexShrink: 1 },
  lang: {
    paddingHorizontal: 9,
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: '#102D43',
    borderWidth: 1,
    borderColor: '#31516A',
  },
  langActive: { backgroundColor: '#2EA6FF', borderColor: '#2EA6FF' },
  langText: { color: '#A9BDC9', fontSize: font.small, fontWeight: '700' },
  langTextActive: { color: colors.white },
});
