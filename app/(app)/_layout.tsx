import { randomUUID } from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { markSent, startSession } from '../../src/api/sessions';
import { listVehicles } from '../../src/api/vehicles';
import { recordFalsePositive } from '../../src/detection/falsePositives';
import {
  buildAlreadyPaidStart,
  decideReminderAction,
  emitReminderLog,
  REMINDER_CATEGORY_ID,
  reminderActionButtons,
} from '../../src/detection/reminderActions';
import {
  planStopReminders,
  reminderDeliveries,
  type ReminderNotificationData,
} from '../../src/detection/reminders';
import { loadZoneCache } from '../../src/zones/cache';
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

async function cancelStopReminderNotifications(stopId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`${stopId}:first`);
  } catch {}
  try {
    await Notifications.cancelScheduledNotificationAsync(`${stopId}:second`);
  } catch {}
}

function logZoneCode(data: Record<string, unknown> | undefined): string {
  if (data && typeof data.zoneCode === 'string' && data.zoneCode.length > 0) {
    return data.zoneCode;
  }
  return '?';
}

function stopIdFromData(data: Record<string, unknown> | undefined): string | null {
  if (data && typeof data.stopId === 'string' && data.stopId.length > 0) {
    return data.stopId;
  }
  return null;
}

function zoneCodeFromData(data: Record<string, unknown> | undefined): string | null {
  if (data && typeof data.zoneCode === 'string' && data.zoneCode.length > 0) {
    return data.zoneCode;
  }
  return null;
}

const alreadyPaidIdempotencyKeys = new Map<string, string>();

function reminderPointFromData(
  data: Record<string, unknown> | undefined,
): { latitude: number; longitude: number; accuracyM?: number } | null {
  if (!data) {
    return null;
  }
  const latitude = data.latitude;
  const longitude = data.longitude;
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  const point = { latitude, longitude };
  const accuracyM = data.accuracyM;
  if (typeof accuracyM === 'number' && Number.isFinite(accuracyM)) {
    return { ...point, accuracyM };
  }
  return point;
}

function withReminderPoint(
  base: ReminderNotificationData,
  source: Record<string, unknown> | undefined,
): ReminderNotificationData {
  const point = reminderPointFromData(source);
  if (!point) {
    return base;
  }
  const merged: ReminderNotificationData = {
    ...base,
    latitude: point.latitude,
    longitude: point.longitude,
  };
  if (point.accuracyM !== undefined) {
    merged.accuracyM = point.accuracyM;
  }
  return merged;
}

export default function AppLayout() {
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const buttons = reminderActionButtons(locale);
    void Notifications.setNotificationCategoryAsync(
      REMINDER_CATEGORY_ID,
      buttons.map(({ identifier, buttonTitle }) => ({
        identifier,
        buttonTitle,
        options: { opensAppToForeground: true },
      })),
    );
  }, [locale]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const actionIdentifier = response.actionIdentifier;
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const zoneForLog = logZoneCode(data);
        const decision = decideReminderAction(actionIdentifier);

        if (decision === 'open-pay') {
          emitReminderLog(`reminder action pay-now ${zoneForLog}`);
          const zoneCode = zoneCodeFromData(data);
          if (zoneCode) {
            router.push({
              pathname: '/(app)/pay',
              params: { zoneCode },
            });
          }
          return;
        }

        if (decision === 'false-positive') {
          const stopId = stopIdFromData(data);
          void (async () => {
            try {
              const n = await recordFalsePositive();
              if (stopId) {
                await cancelStopReminderNotifications(stopId);
              }
              emitReminderLog(
                `reminder action not-parking ${zoneForLog} false-positive ${n}`,
              );
            } catch {
              if (stopId) {
                await cancelStopReminderNotifications(stopId);
              }
              emitReminderLog(`reminder action not-parking ${zoneForLog} failed`);
            }
          })();
          return;
        }

        if (decision === 'cancel') {
          emitReminderLog(`reminder action ${actionIdentifier} ${zoneForLog}`);
          const stopId = stopIdFromData(data);
          if (stopId) {
            void cancelStopReminderNotifications(stopId);
          }
          return;
        }

        if (decision === 'mark-sent') {
          const zoneCode = zoneCodeFromData(data);
          const stopId = stopIdFromData(data);
          const zoneLog = zoneCode ?? zoneForLog;

          void (async () => {
            if (!zoneCode || !stopId) {
              emitReminderLog(`reminder action already-paid ${zoneLog} failed`);
              return;
            }

            let vehicles: Awaited<ReturnType<typeof listVehicles>> = [];
            try {
              vehicles = await listVehicles();
            } catch {
              emitReminderLog(`reminder action already-paid ${zoneCode} failed`);
              return;
            }

            const chosen = vehicles.find((v) => v.is_default) ?? vehicles[0];
            const point = reminderPointFromData(data);

            let paymentModel: 'prepaid' | 'session' | null = null;
            try {
              const cache = await loadZoneCache();
              const feature = cache.features.find(
                (f) => f.properties.code === zoneCode,
              );
              const model = feature?.properties.operator?.payment_model;
              if (model === 'prepaid' || model === 'session') {
                paymentModel = model;
              }
            } catch {
              // keep null
            }

            const built = buildAlreadyPaidStart(
              point,
              zoneCode,
              chosen
                ? { id: chosen.id, default_park_time: chosen.default_park_time }
                : null,
              paymentModel,
            );

            if (!built.ok) {
              emitReminderLog(
                `reminder action already-paid ${zoneCode} ${built.reason}`,
              );
              return;
            }

            let key = alreadyPaidIdempotencyKeys.get(stopId);
            if (!key) {
              key = randomUUID();
              alreadyPaidIdempotencyKeys.set(stopId, key);
            }

            try {
              const result = await startSession(built.body, {
                idempotencyKey: key,
              });
              const sessionId = result.data.id;
              if (!Number.isFinite(sessionId)) {
                emitReminderLog(`reminder action already-paid ${zoneCode} failed`);
                return;
              }
              await markSent(sessionId);
            } catch {
              emitReminderLog(`reminder action already-paid ${zoneCode} failed`);
              return;
            }

            await cancelStopReminderNotifications(stopId);
            emitReminderLog(`reminder action already-paid ${zoneCode} sent`);
          })();
          return;
        }

        emitReminderLog(`reminder action snooze ${zoneForLog}`);
        const stopId = stopIdFromData(data);
        const zoneCode = zoneCodeFromData(data);
        if (!stopId || !zoneCode) {
          return;
        }

        void (async () => {
          await cancelStopReminderNotifications(stopId);
          const nowMs = Date.now();
          const plan = planStopReminders({
            stopId,
            zoneCode,
            operatorName: '',
            locale: locale === 'en' ? 'en' : 'mk',
            nowMs,
            anchorMs: nowMs,
            scheduledCount: 1,
            secondDelayMinutes: 5,
            eligible: true,
          });
          const deliveries = reminderDeliveries(plan);
          for (const delivery of deliveries) {
            await Notifications.scheduleNotificationAsync({
              identifier: delivery.identifier,
              content: {
                title: delivery.title,
                body: delivery.body,
                data: withReminderPoint(delivery.data, data),
                categoryIdentifier: REMINDER_CATEGORY_ID,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(delivery.fireAtMs),
              },
            });
          }
        })();
      },
    );
    return () => subscription.remove();
  }, [locale, router]);

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
