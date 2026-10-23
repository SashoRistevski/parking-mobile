import { Stack } from 'expo-router';

import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function AppLayout() {
  const { t } = useLocale();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: t('back'),
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="explain/location"
        options={{ title: t('location') }}
      />
      <Stack.Screen name="explain/motion" options={{ title: t('motion') }} />
      <Stack.Screen
        name="explain/notifications"
        options={{ title: t('notifications') }}
      />
    </Stack>
  );
}
