import React from 'react';
import { StyleSheet, View } from 'react-native';
import { aws } from '../services/aws';
import { colors, radius, spacing } from '../theme';
import { Body, Muted } from './ui';

/**
 * Shown when no AWS backend URL is configured. Makes it impossible to mistake an
 * unconfigured app for a working one — the previous mock mode silently produced
 * realistic-looking but fabricated verdicts.
 */
export const BackendBanner: React.FC = () => {
  if (aws.isConfigured()) return null;
  return (
    <View style={styles.wrap}>
      <Body style={styles.title}>⚠️ AWS backend not configured</Body>
      <Muted>
        Analysis and the chatbot need AWS. Set “apiBaseUrl” in app.json (expo.extra) to your
        API Gateway URL or local dev server, then reload. See docs/AWS_SETUP.md.
      </Muted>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#3B2A12',
    borderColor: colors.medium,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: { color: colors.medium, fontWeight: '800' },
});
