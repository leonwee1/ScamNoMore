import React from 'react';
import { StyleSheet, View } from 'react-native';
import { api } from '../services/api';
import { colors, radius, spacing } from '../theme';
import { Body, Muted } from './ui';

/**
 * Shown when no backend URL is configured. Makes it impossible to mistake an
 * unconfigured app for a working one — an earlier mock mode silently produced
 * realistic-looking but fabricated verdicts.
 */
export const BackendBanner: React.FC = () => {
  if (api.isConfigured()) return null;
  return (
    <View style={styles.wrap}>
      <Body style={styles.title}>⚠️ Backend not configured</Body>
      <Muted>
        Analysis and the chatbot need the OpenAI backend. Start it with “npm start” in the
        backend folder, then set “apiBaseUrl” in app.json (expo.extra) to your computer’s
        LAN URL and reload. See docs/SETUP.md.
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
