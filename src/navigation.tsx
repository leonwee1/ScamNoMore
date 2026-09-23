import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Text } from 'react-native';
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

const tabIcon = (emoji: string) => ({ color }: { color: string }) =>
  <Text style={{ fontSize: 18, color }}>{emoji}</Text>;

/** Bottom tabs: Home / Search / Report / Community (matches wireframe). */
const Tabs: React.FC = () => {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
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
