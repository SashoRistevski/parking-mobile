import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useLocale } from '../../../src/i18n/LocaleProvider';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function TabsLayout() {
  const { t } = useLocale();
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: isDark ? colors.tabBar : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('mapTitle'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="map-outline" size={26} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="vehicles/index"
        options={{
          title: t('vehicles'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="car-outline" size={26} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('history'),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="time-outline" size={26} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={26} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
