import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { scamStore } from './src/data/scamStore';
import { I18nProvider } from './src/i18n';
import { RootNavigator } from './src/navigation';
import { api } from './src/services/api';
import { TextScaleProvider } from './src/textScale';
import { colors } from './src/theme';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
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
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" />
            <ReportsHydrator />
            <RootNavigator />
          </NavigationContainer>
        </TextScaleProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
