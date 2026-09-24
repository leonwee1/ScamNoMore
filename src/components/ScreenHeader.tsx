import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextSizeSlider } from './TextSizeSlider';
import { LANGS, useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';
import { scaled, useTextScale } from '../textScale';

/**
 * Global header shown on every screen: the language switcher (4 local languages),
 * text-size control, and Chatbot shortcut. The text-size control sits above the
 * Chatbot, which shares a row with the screen brand/title.
 *
 * `title` is OPTIONAL and should be omitted on any screen that already has a
 * native navigation header. Those screens were rendering the same text twice,
 * once in the stack header and again here.
 */
export const ScreenHeader: React.FC<{
  title?: string;
  /** Rendered immediately before the title, e.g. the app's logo on Home. */
  titleIcon?: React.ReactNode;
  /** Main tabs show language and text-size controls; sub-pages do not. */
  showControls?: boolean;
}> = ({ title, titleIcon, showControls = false }) => {
  const { lang, setLang, t } = useI18n();
  const { scale } = useTextScale();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.wrap}>
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
          <TextSizeSlider />
        </View>
      ) : null}

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
          <Text style={[styles.chatText, { fontSize: scaled(font.small, scale) }]}>💬 {t('chatbot.title')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.md },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // The compact slider is sized to keep this control row together even at
    // the largest language-label setting.
    flexWrap: 'nowrap',
    gap: spacing.sm,
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
    paddingHorizontal: 10,
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  langTextActive: { color: colors.white },
});
