import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { LocaleProvider } from '../src/i18n/LocaleProvider';
import { FontProvider } from '../src/theme/FontContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import type { User } from '../src/api/types';

function userMissingEmailVerifiedField(user: User): boolean {
  return !Object.prototype.hasOwnProperty.call(user, 'email_verified_at');
}

function isEmailUnverified(user: User): boolean {
  return user.email_verified_at == null;
}

function RootNavigator() {
  const { token, user, isLoading, refreshUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  const emailFieldRefreshScopeKey =
    !isLoading && token && user && userMissingEmailVerifiedField(user)
      ? `${token}:${user.id}`
      : null;
  const needsEmailFieldRefresh = emailFieldRefreshScopeKey != null;
  const [completedEmailFieldRefreshScopeKey, setCompletedEmailFieldRefreshScopeKey] =
    useState<string | null>(null);
  const emailGateReady =
    !needsEmailFieldRefresh ||
    completedEmailFieldRefreshScopeKey === emailFieldRefreshScopeKey;

  useEffect(() => {
    if (!needsEmailFieldRefresh || !emailFieldRefreshScopeKey) {
      return;
    }

    const scopeKey = emailFieldRefreshScopeKey;
    let cancelled = false;
    void (async () => {
      try {
        await refreshUser();
      } catch {
        // treat as unverified; routing sends to verify-email
      } finally {
        if (!cancelled) {
          setCompletedEmailFieldRefreshScopeKey(scopeKey);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsEmailFieldRefresh, emailFieldRefreshScopeKey, refreshUser]);

  useEffect(() => {
    if (isLoading || !emailGateReady) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const onVerifyEmail =
      segments[0] === '(app)' && segments[1] === 'verify-email';

    if (!token) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (!user) {
      return;
    }

    if (isEmailUnverified(user)) {
      if (!onVerifyEmail) {
        router.replace('/(app)/verify-email');
      }
      return;
    }

    if (inAuthGroup) {
      router.replace('/(app)');
    }
  }, [token, user, isLoading, emailGateReady, segments, router]);

  if (isLoading || (token && user && !emailGateReady)) {
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
