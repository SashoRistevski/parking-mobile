import { Ionicons } from '@expo/vector-icons';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resendEmailVerificationCode } from '../api/auth';
import { displayErrorMessage } from '../api/errors';
import { planConfirmNag } from './confirmNag';
import { useAuth } from './AuthContext';
import {
  readEmailNagDate,
  skopjeTodayDate,
  writeEmailNagDate,
} from './emailNagStorage';
import { AppText } from '../components/AppText';
import { useLocale } from '../i18n/LocaleProvider';
import { useTheme } from '../theme/ThemeProvider';

function userFieldString(
  user: { email_verified_at?: string | null; created_at?: string } | null,
  key: 'email_verified_at' | 'created_at',
): string | null {
  if (!user) {
    return null;
  }
  const value = user[key];
  if (value == null) {
    return null;
  }
  return typeof value === 'string' ? value : null;
}

export function ConfirmEmailTabsLayout() {
  const { t } = useLocale();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loadedUserKey, setLoadedUserKey] = useState<string | null>(null);
  const userKey = String(user?.id ?? 'no-user');
  const profileLoaded = loadedUserKey === userKey;
  const [lastNagDate, setLastNagDate] = useState<string | null>(null);
  const [plan, setPlan] = useState({ showBanner: false, showNag: false });
  const [resentMessage, setResentMessage] = useState(false);
  const [resending, setResending] = useState(false);
  const nagCommittedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setLastNagDate(readEmailNagDate());
    }, []),
  );

  useEffect(() => {
    let cancelled = false;

    async function ensureProfile() {
      const key = String(user?.id ?? 'no-user');
      if (!user) {
        if (!cancelled) {
          setLoadedUserKey('no-user');
        }
        return;
      }
      if (userFieldString(user, 'created_at')) {
        if (!cancelled) {
          setLoadedUserKey(key);
        }
        return;
      }
      try {
        await refreshUser();
      } catch {
        // keep deciding with whatever user we have
      }
      if (!cancelled) {
        setLoadedUserKey(key);
      }
    }

    void ensureProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.created_at, refreshUser, user]);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }
      if (!profileLoaded || !user) {
        setPlan({ showBanner: false, showNag: false });
        return;
      }
      const createdAt = userFieldString(user, 'created_at');
      if (!createdAt) {
        setPlan({ showBanner: false, showNag: false });
        return;
      }
      const nowMs = Date.now();
      const today = skopjeTodayDate(nowMs);
      setPlan(
        planConfirmNag({
          emailVerifiedAt: userFieldString(user, 'email_verified_at'),
          createdAt,
          nowMs,
          lastNagDate,
          today,
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [profileLoaded, user, lastNagDate]);

  useEffect(() => {
    if (!plan.showNag || nagCommittedRef.current) {
      return;
    }
    const today = skopjeTodayDate(Date.now());
    if (lastNagDate === today) {
      return;
    }
    nagCommittedRef.current = true;
    Alert.alert(t('emailVerifyTitle'), undefined, [
      {
        text: t('emailVerifyConfirm'),
        onPress: () => {
          router.push('/(app)/verify-email');
        },
      },
    ]);
    void writeEmailNagDate(today)
      .catch(() => {})
      .finally(() => {
        setLastNagDate(today);
      });
  }, [plan.showNag, lastNagDate, router, t]);

  async function onResend() {
    if (resending) {
      return;
    }
    setResending(true);
    setResentMessage(false);
    try {
      await resendEmailVerificationCode();
      setResentMessage(true);
    } catch (err) {
      Alert.alert(displayErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.root}>
      {plan.showBanner ? (
        <View
          style={[
            styles.banner,
            {
              paddingTop: insets.top + 8,
              backgroundColor: isDark ? colors.card : colors.primary600,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <AppText
            variant="label"
            style={{ color: isDark ? colors.text : colors.textOnPrimary }}
          >
            {t('emailVerifyTitle')}
          </AppText>
          {resentMessage ? (
            <AppText
              variant="body"
              style={[
                styles.resent,
                { color: isDark ? colors.primary : colors.textOnPrimary },
              ]}
            >
              {t('emailVerifyResent')}
            </AppText>
          ) : null}
          <View style={styles.bannerActions}>
            <Pressable
              onPress={() => router.push('/(app)/verify-email')}
              style={({ pressed }) => [
                styles.bannerButton,
                pressed && styles.pressed,
              ]}
            >
              <AppText
                variant="label"
                style={{ color: isDark ? colors.primary : colors.textOnPrimary }}
              >
                {t('emailVerifyConfirm')}
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => void onResend()}
              disabled={resending}
              style={({ pressed }) => [
                styles.bannerButton,
                pressed && styles.pressed,
                resending && styles.disabled,
              ]}
            >
              <AppText
                variant="label"
                style={{ color: isDark ? colors.primary : colors.textOnPrimary }}
              >
                {resending ? t('emailVerifyResending') : t('emailVerifyResend')}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  banner: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 6,
  },
  resent: {
    marginTop: 2,
  },
  bannerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 4,
  },
  bannerButton: {
    paddingVertical: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
