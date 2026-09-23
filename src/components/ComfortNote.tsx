import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useI18n } from '../i18n';
import { colors, font } from '../theme';
import { Body } from './ui';

/**
 * Reassurance for someone who has just been scammed, with the 1799 helpline
 * picked out.
 *
 * The helpline is the single most actionable thing in this message, so it is
 * rendered in the accent colour and bold rather than buried in a paragraph. The
 * copy carries a `{helpline}` token and is split around it at render time, which
 * keeps the emphasis working in every language regardless of where the phrase
 * falls in the sentence — in Chinese and Tamil it lands in a different position
 * than in English.
 */
const TOKEN = '{helpline}';

export const ComfortNote: React.FC = () => {
  const { t } = useI18n();
  const helpline = t('report.helpline');
  const text = t('report.comfort');

  const at = text.indexOf(TOKEN);
  // No token (e.g. a dictionary edit dropped it) — show the text as-is rather
  // than losing the message entirely.
  if (at === -1) return <Body>{text}</Body>;

  return (
    <Body>
      {text.slice(0, at)}
      <Text style={styles.helpline}>{helpline}</Text>
      {text.slice(at + TOKEN.length)}
    </Body>
  );
};

const styles = StyleSheet.create({
  helpline: { color: colors.primary, fontWeight: '800', fontSize: font.body },
});
