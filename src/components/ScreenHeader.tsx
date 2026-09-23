import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGS, useI18n } from '../i18n';
import { colors, font, radius, spacing } from '../theme';

/**
 * Global header shown on every screen. Provides the language switcher (4 local
 * languages) and the Chatbot button that the wireframe places on every screen.
 */
export const ScreenHeader: React.FC<{ title: string }> = ({ title }) => {
  const { lang, setLang, t } = useI18n();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.wrap}>
      {/* Language selector sits ABOVE the title + Chatbot row, so the choice of
          language is the first control on every screen. */}
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
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Chatbot')}
          style={styles.chatBtn}
          accessibilityRole="button"
          accessibilityLabel={t('chatbot.title')}
        >
          <Text style={styles.chatText}>💬 {t('chatbot.title')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: font.h1, fontWeight: '800', flex: 1 },
  chatBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatText: { color: colors.primary, fontWeight: '700', fontSize: font.small },
  langRow: { flexDirection: 'row', gap: spacing.xs },
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
