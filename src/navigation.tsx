import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useI18n } from './i18n';
import { ChatbotScreen } from './screens/ChatbotScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ImageAnalysisScreen } from './screens/ImageAnalysisScreen';
import { ReportScreen } from './screens/ReportScreen';
import { SearchScreen } from './screens/SearchScreen';
import { VideoAnalysisScreen } from './screens/VideoAnalysisScreen';
import { VoiceAnalysisScreen } from './screens/VoiceAnalysisScreen';
import { scaled, useTextScale } from './textScale';
import { colors } from './theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/** Small line icons render consistently instead of relying on platform emoji. */
type TabIconKind = 'home' | 'search' | 'report' | 'community';

const TabGlyph: React.FC<{ kind: TabIconKind; focused: boolean }> = ({ kind, focused }) => {
  const common = {
    fill: 'none' as const,
    stroke: focused ? colors.primary : colors.textMuted,
    strokeWidth: focused ? 2.2 : 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (kind === 'home') return <Path d="M3 9.5 10 3l7 6.5v7H3z M7 17v-4h6v4" {...common} />;
  if (kind === 'search') return <><Circle cx="8.2" cy="8.2" r="4.7" {...common} /><Path d="m11.8 11.8 4.2 4.2" {...common} /></>;
  if (kind === 'report') return <><Rect x="4" y="2.8" width="11.5" height="14.4" rx="1.5" {...common} /><Path d="M7 7h5.5M7 10h5.5M7 13h3M14.5 5.2h3M16 3.7v3" {...common} /></>;
  return <><Path d="M3 4.2h10.5a2 2 0 0 1 2 2v5.1a2 2 0 0 1-2 2H8l-3.5 3v-3H3a2 2 0 0 1-2-2V6.2a2 2 0 0 1 2-2Z" {...common} /><Path d="M5 8h5.5M5 10.5h3.5" {...common} /></>;
};

const tabIcon = (kind: TabIconKind) => ({ focused }: { focused: boolean }) => (
  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
    <Svg width={20} height={20} viewBox="0 0 20 20" accessibilityLabel={kind}>
      <TabGlyph kind={kind} focused={focused} />
    </Svg>
  </View>
);

/** Bottom tabs: Home / Search / Report / Community (matches wireframe). */
const Tabs: React.FC = () => {
  const { t } = useI18n();
  const { scale } = useTextScale();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Deliberately NO fixed height. React Navigation adds the device's
          // bottom safe-area inset to the bar itself; pinning the height
          // overrides that, so on a phone with a gesture bar the icons and
          // labels were pushed down over the system divider — which showed as a
          // pale line straight through "Search" and "Report". Letting the
          // library size the bar keeps the labels clear of it.
          paddingTop: 4,
        },
        // Bold on the selected tab, so the label reinforces the pill rather
        // than depending on colour alone.
        tabBarLabelStyle: { fontSize: scaled(12, scale), fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: t('tab.home'), tabBarIcon: tabIcon('home') }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{ title: t('tab.search'), tabBarIcon: tabIcon('search') }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportScreen}
        options={{ title: t('tab.report'), tabBarIcon: tabIcon('report') }}
      />
      <Tab.Screen
        name="CommunityTab"
        component={CommunityScreen}
        options={{ title: t('tab.community'), tabBarIcon: tabIcon('community') }}
      />
    </Tab.Navigator>
  );
};

/** Root stack wraps the tabs and holds the modal-ish analysis + chatbot screens. */
export const RootNavigator: React.FC = () => {
  const { t } = useI18n();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
        // Show only the chevron on the back button. Otherwise iOS labels it with
        // the previous route's name — which surfaced the internal route id
        // "Tabs" as untranslated English next to a Chinese title.
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      {/* Analysis flows own their back action inside the shared first row, so
          the native stack header does not appear above ScamNoMore. */}
      <Stack.Screen
        name="ImageAnalysis"
        component={ImageAnalysisScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VoiceAnalysis"
        component={VoiceAnalysisScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VideoAnalysis"
        component={VideoAnalysisScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chatbot"
        component={ChatbotScreen}
        options={{ title: t('chatbot.title') }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  // Sized to fit the tab bar's default height alongside the label.
  iconWrap: {
    width: 44,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A small mint pill marks the current tab without overpowering the label.
  iconWrapActive: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
  },
});
