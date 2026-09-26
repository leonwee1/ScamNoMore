import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { scamStore } from './src/data/scamStore';
import { I18nProvider } from './src/i18n';
import { RootNavigator } from './src/navigation';
import { api } from './src/services/api';
import { TextScaleProvider } from './src/textScale';
import { colors } from './src/theme';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

/**
 * A network failure never hides the bundled 5,000 verified cases. When the
 * backend is configured, this replaces the remote-report slice with the shared
 * SQLite rows so a fresh Expo session/device sees previous submissions.
 */
const ReportsHydrator: React.FC = () => {
  useEffect(() => {
    if (!api.isConfigured()) return;

    let active = true;
    api
      .listReports()
      .then((reports) => {
        if (active) scamStore.hydrateReports(reports);
      })
      .catch((error: unknown) => {
        // Offline/demo failures leave the verified bundled dataset usable.
        console.warn('Could not load shared incident reports:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  return null;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <TextScaleProvider>
          <View style={Platform.OS === 'web' ? styles.webPhoneFrame : styles.nativeFrame}>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="dark" />
              <ReportsHydrator />
              <RootNavigator />
            </NavigationContainer>
          </View>
        </TextScaleProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  nativeFrame: { flex: 1 },
  // The web preview is intentionally phone-shaped without affecting native
  // builds. A browser remains rectangular around it, but the app itself has a
  // mobile-width canvas, handset-like corners, and a light bezel/shadow.
  webPhoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#C9D8D8',
    backgroundColor: colors.bg,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
