import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from './i18n';
import { ChatbotScreen } from './screens/ChatbotScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ImageAnalysisScreen } from './screens/ImageAnalysisScreen';
import { ReportScreen } from './screens/ReportScreen';
import { SearchScreen } from './screens/SearchScreen';
import { VideoAnalysisScreen } from './screens/VideoAnalysisScreen';
import { VoiceAnalysisScreen } from './screens/VoiceAnalysisScreen';
import { colors } from './theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/**
 * Tab icon with an explicit selected state.
 *
 * `tabBarActiveTintColor` alone was not enough here: the icons are emoji, and an
 * emoji glyph ignores the text colour it is given, so the only thing that
 * changed on selection was the small label underneath. The active tab now gets a
 * filled pill behind its icon, a larger glyph, and full opacity, so the current
 * tab is obvious without relying on a colour difference at all.
 */
const tabIcon = (emoji: string) => ({ focused }: { focused: boolean }) => (
  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
    <Text style={focused ? styles.iconActive : styles.iconIdle}>{emoji}</Text>
  </View>
);

/** Bottom tabs: Home / Search / Report / Community (matches wireframe). */
const Tabs: React.FC = () => {
  const { t } = useI18n();
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
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: t('tab.home'), tabBarIcon: tabIcon('🏠') }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{ title: t('tab.search'), tabBarIcon: tabIcon('🔎') }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportScreen}
        options={{ title: t('tab.report'), tabBarIcon: tabIcon('📝') }}
      />
      <Tab.Screen
        name="CommunityTab"
        component={CommunityScreen}
        options={{ title: t('tab.community'), tabBarIcon: tabIcon('👥') }}
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
      {/* Each header names the GROUP the user tapped from on Home ("Text",
          "Voice", "Video") rather than the individual button, so the heading
          matches the card they came from and reads the same in both modes. */}
      <Stack.Screen
        name="ImageAnalysis"
        component={ImageAnalysisScreen}
        options={{ title: t('home.text.group') }}
      />
      <Stack.Screen
        name="VoiceAnalysis"
        component={VoiceAnalysisScreen}
        options={{ title: t('home.voice.group') }}
      />
      <Stack.Screen
        name="VideoAnalysis"
        component={VideoAnalysisScreen}
        options={{ title: t('home.video.group') }}
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
  // Sized to fit the tab bar's default height alongside the label, now that the
  // height is no longer pinned: 4pt padding + 26 icon + ~15 label ≈ 45, inside
  // the standard 49pt bar.
  iconWrap: {
    width: 44,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Filled pill marks the current tab. Emoji ignore tintColor, so without this
  // the only cue was the small label text changing colour.
  iconWrapActive: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  iconActive: { fontSize: 19 },
  iconIdle: { fontSize: 17, opacity: 0.55 },
});
