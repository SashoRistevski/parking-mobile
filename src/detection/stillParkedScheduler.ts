import { getLocales } from 'expo-localization';
import * as Notifications from 'expo-notifications';

import type { ParkingSession } from '../api/sessions';
import {
  planStillParked,
  STILL_PARKED_ID,
} from './stillParked';
import { readReminderDelays } from './reminderDelaysStorage';
import { readRemindersEnabled } from './remindersEnabledStorage';

export { STILL_PARKED_ID };

export type StillParkedNotificationData = {
  sessionId: number;
  kind: 'still-parked';
};

const DEFAULT_TAP_ACTION = 'expo.modules.notifications.actions.DEFAULT';

const STOP_BUTTON = {
  en: 'Stop',
  mk: 'Стоп',
} as const;

function deviceLocaleEn(): boolean {
  return getLocales()[0]?.languageCode === 'en';
}

export function stillParkedCategoryButtons(
  locale: string,
): { identifier: string; buttonTitle: string }[] {
  const lang = locale === 'en' ? 'en' : 'mk';
  return [
    {
      identifier: 'stop',
      buttonTitle: STOP_BUTTON[lang],
    },
  ];
}

function stillParkedBody(zoneCode: string | null | undefined): string {
  const en = deviceLocaleEn();
  const code =
    typeof zoneCode === 'string' && zoneCode.length > 0 ? zoneCode : null;
  if (en) {
    return code
      ? `Still parked in ${code}? Send S to stop.`
      : 'Still parked? Send S to stop.';
  }
  return code
    ? `Сè уште паркирате во ${code}? Испрати S за стоп.`
    : 'Сè уште паркирате? Испрати S за стоп.';
}

export function isStillParkedResponse(
  categoryIdentifier: string | null | undefined,
  data: Record<string, unknown> | undefined,
): boolean {
  if (categoryIdentifier === STILL_PARKED_ID) {
    return true;
  }
  return data?.kind === 'still-parked';
}

export function shouldOpenSessionFromStillParked(
  actionIdentifier: string,
): boolean {
  return (
    actionIdentifier === 'stop' || actionIdentifier === DEFAULT_TAP_ACTION
  );
}

export function sessionIdFromStillParkedData(
  data: Record<string, unknown> | undefined,
): number | undefined {
  const sessionId = data?.sessionId;
  if (typeof sessionId === 'number' && Number.isFinite(sessionId)) {
    return sessionId;
  }
  return undefined;
}

async function cancelStillParkedNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(STILL_PARKED_ID);
  } catch {
    // ignore
  }
}

export async function syncStillParked(
  session: ParkingSession | null,
): Promise<void> {
  await cancelStillParkedNotification();

  if (!readRemindersEnabled()) {
    return;
  }

  if (!session || session.payment_model !== 'session') {
    return;
  }

  const startedAt = session.started_at;
  if (!startedAt) {
    return;
  }

  const nowMs = Date.now();
  const plan = planStillParked({
    startedAt,
    nowMs,
    afterHours: readReminderDelays().stillParkedAfterHours,
  });

  if (!plan.fire) {
    return;
  }

  const zoneCode = session.zone?.code;
  const data: StillParkedNotificationData = {
    sessionId: session.id,
    kind: 'still-parked',
  };

  const trigger =
    plan.fireAtMs === nowMs
      ? null
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE as const,
          date: new Date(plan.fireAtMs),
        };

  await Notifications.scheduleNotificationAsync({
    identifier: STILL_PARKED_ID,
    content: {
      title: 'Smart Park',
      body: stillParkedBody(zoneCode),
      data,
      categoryIdentifier: STILL_PARKED_ID,
    },
    trigger,
  });
}
