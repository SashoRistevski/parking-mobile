import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { LocaleProvider } from '../src/i18n/LocaleProvider';
import { FontProvider } from '../src/theme/FontContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

function RootNavigator() {
  const {
    token,
    user,
    isLoading,
    pendingPostRegisterSetup,
    clearPostRegisterSetup,
  } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!token) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (token && user && inAuthGroup) {
      if (pendingPostRegisterSetup) {
        clearPostRegisterSetup();
        router.replace('/(app)/setup');
      } else {
        router.replace('/(app)');
      }
    }
  }, [
    token,
    user,
    isLoading,
    segments,
    router,
    pendingPostRegisterSetup,
    clearPostRegisterSetup,
  ]);

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

function RootLayoutInner() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const { colors } = useTheme();
  const interReady = fontsLoaded || fontError != null;

  if (!interReady) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FontProvider interLoaded={fontsLoaded && !fontError}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </FontProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <ThemeProvider>
          <RootLayoutInner />
        </ThemeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
