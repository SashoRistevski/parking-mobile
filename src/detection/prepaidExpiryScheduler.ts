import { getLocales } from 'expo-localization';
import * as Notifications from 'expo-notifications';

import type { ParkingSession } from '../api/sessions';
import {
  planPrepaidExpiry,
  PREPAID_EXPIRY_ID,
} from './prepaidExpiry';
import { readReminderDelays } from './reminderDelaysStorage';
import { readRemindersEnabled } from './remindersEnabledStorage';

export { PREPAID_EXPIRY_ID };

export type PrepaidExpiryNotificationData = {
  sessionId: number;
  kind: 'prepaid-expiry';
};

const DEFAULT_TAP_ACTION = 'expo.modules.notifications.actions.DEFAULT';

const EXTEND_BUTTON = {
  en: 'Extend',
  mk: 'Продолжи',
} as const;

function deviceLocaleEn(): boolean {
  return getLocales()[0]?.languageCode === 'en';
}

export function prepaidExpiryCategoryButtons(
  locale: string,
): { identifier: string; buttonTitle: string }[] {
  const lang = locale === 'en' ? 'en' : 'mk';
  return [
    {
      identifier: 'extend',
      buttonTitle: EXTEND_BUTTON[lang],
    },
  ];
}

function prepaidExpiryBody(zoneCode: string | null | undefined): string {
  const en = deviceLocaleEn();
  const code =
    typeof zoneCode === 'string' && zoneCode.length > 0 ? zoneCode : null;
  if (en) {
    return code
      ? `Parking in ${code} expires soon. Extend?`
      : 'Parking expires soon. Extend?';
  }
  return code
    ? `Паркирањето во ${code} истекува наскоро. Продолжи?`
    : 'Паркирањето истекува наскоро. Продолжи?';
}

export function isPrepaidExpiryResponse(
  categoryIdentifier: string | null | undefined,
  data: Record<string, unknown> | undefined,
): boolean {
  if (categoryIdentifier === PREPAID_EXPIRY_ID) {
    return true;
  }
  return data?.kind === 'prepaid-expiry';
}

export function shouldOpenSessionFromPrepaidExpiry(
  actionIdentifier: string,
): boolean {
  return (
    actionIdentifier === 'extend' || actionIdentifier === DEFAULT_TAP_ACTION
  );
}

export function sessionIdFromPrepaidExpiryData(
  data: Record<string, unknown> | undefined,
): number | undefined {
  const sessionId = data?.sessionId;
  if (typeof sessionId === 'number' && Number.isFinite(sessionId)) {
    return sessionId;
  }
  return undefined;
}

async function cancelPrepaidExpiryNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(PREPAID_EXPIRY_ID);
  } catch {
    // ignore
  }
}

export async function syncPrepaidExpiry(
  session: ParkingSession | null,
): Promise<void> {
  await cancelPrepaidExpiryNotification();

  if (!readRemindersEnabled()) {
    return;
  }

  if (!session || session.payment_model !== 'prepaid') {
    return;
  }

  const paidUntilLocal = session.paid_until_local;
  if (!paidUntilLocal) {
    return;
  }

  const nowMs = Date.now();
  const plan = planPrepaidExpiry({
    paidUntilLocal,
    nowMs,
    leadMinutes: readReminderDelays().prepaidExpiryLeadMinutes,
  });

  if (!plan.fire) {
    return;
  }

  const zoneCode = session.zone?.code;
  const data: PrepaidExpiryNotificationData = {
    sessionId: session.id,
    kind: 'prepaid-expiry',
  };

  const trigger =
    plan.fireAtMs === nowMs
      ? null
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE as const,
          date: new Date(plan.fireAtMs),
        };

  await Notifications.scheduleNotificationAsync({
    identifier: PREPAID_EXPIRY_ID,
    content: {
      title: 'Smart Park',
      body: prepaidExpiryBody(zoneCode),
      data,
      categoryIdentifier: PREPAID_EXPIRY_ID,
    },
    trigger,
  });
}
