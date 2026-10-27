import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function AppLayout() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        const zoneCode =
          data && typeof data.zoneCode === 'string' ? data.zoneCode : null;
        if (zoneCode) {
          router.push({
            pathname: '/(app)/pay',
            params: { zoneCode },
          });
        }
      },
    );
    return () => subscription.remove();
  }, [router]);

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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="setup"
        options={{
          title: t('setupTitle'),
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="explain/location"
        options={{ title: t('location') }}
      />
      <Stack.Screen name="explain/motion" options={{ title: t('motion') }} />
      <Stack.Screen
        name="explain/notifications"
        options={{ title: t('notifications') }}
      />
      <Stack.Screen name="drive-test" options={{ title: 'Drive test' }} />
      <Stack.Screen
        name="report-zone"
        options={{ title: t('reportWrongZoneTitle') }}
      />
      <Stack.Screen
        name="pay"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen name="session" options={{ headerShown: false }} />
      <Stack.Screen
        name="vehicles/new"
        options={{ title: t('addVehicle') }}
      />
      <Stack.Screen
        name="vehicles/[id]"
        options={{ title: t('editVehicle') }}
      />
    </Stack>
  );
}
