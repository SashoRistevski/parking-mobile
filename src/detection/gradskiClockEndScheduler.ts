import { getLocales } from 'expo-localization';
import * as Notifications from 'expo-notifications';

import type { ParkingSession } from '../api/sessions';
import type { ZoneFeature } from '../detection/zone';
import {
  findFeatureByCode,
  loadZoneCache,
  paidEndsAt,
} from '../zones/cache';
import {
  GRADSKI_CLOCK_END_ID,
  planGradskiClockEnd,
} from './gradskiClockEnd';
import { readRemindersEnabled } from './remindersEnabledStorage';

export { GRADSKI_CLOCK_END_ID };

export type GradskiClockEndNotificationData = {
  sessionId: number;
  kind: 'gradski-clock-end';
};

const DEFAULT_TAP_ACTION = 'expo.modules.notifications.actions.DEFAULT';

const STOP_BUTTON = {
  en: 'Stop',
  mk: 'Стоп',
} as const;

function deviceLocaleEn(): boolean {
  return getLocales()[0]?.languageCode === 'en';
}

export function gradskiClockEndCategoryButtons(
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

function gradskiClockEndBody(zoneCode: string | null | undefined): string {
  const en = deviceLocaleEn();
  const code =
    typeof zoneCode === 'string' && zoneCode.length > 0 ? zoneCode : null;
  if (en) {
    return code
      ? `Parking in ${code} is free now. Send S to stop.`
      : 'Parking is free now. Send S to stop.';
  }
  return code
    ? `Паркирањето во ${code} е бесплатно. Испрати S за стоп.`
    : 'Паркирањето е бесплатно. Испрати S за стоп.';
}

export function isGradskiClockEndResponse(
  categoryIdentifier: string | null | undefined,
  data: Record<string, unknown> | undefined,
): boolean {
  if (categoryIdentifier === GRADSKI_CLOCK_END_ID) {
    return true;
  }
  return data?.kind === 'gradski-clock-end';
}

export function shouldOpenSessionFromGradskiClockEnd(
  actionIdentifier: string,
): boolean {
  return (
    actionIdentifier === 'stop' || actionIdentifier === DEFAULT_TAP_ACTION
  );
}

export function sessionIdFromGradskiClockEndData(
  data: Record<string, unknown> | undefined,
): number | undefined {
  const sessionId = data?.sessionId;
  if (typeof sessionId === 'number' && Number.isFinite(sessionId)) {
    return sessionId;
  }
  return undefined;
}

async function cancelGradskiClockEndNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(GRADSKI_CLOCK_END_ID);
  } catch {
    // ignore
  }
}

export async function syncGradskiClockEnd(
  session: ParkingSession | null,
): Promise<void> {
  await cancelGradskiClockEndNotification();

  if (!readRemindersEnabled()) {
    return;
  }

  if (!session || session.payment_model !== 'session') {
    return;
  }

  let features: ZoneFeature[];
  try {
    const cache = await loadZoneCache();
    features = cache.features;
  } catch {
    return;
  }

  const zoneCode = session.zone?.code;
  const feature = findFeatureByCode(features, zoneCode ?? null);
  const endsAt = feature ? paidEndsAt(feature) : null;
  if (!zoneCode || !feature || !endsAt) {
    return;
  }

  const nowMs = Date.now();
  const plan = planGradskiClockEnd({ endsAt, nowMs });
  if (!plan.fire) {
    return;
  }

  const data: GradskiClockEndNotificationData = {
    sessionId: session.id,
    kind: 'gradski-clock-end',
  };

  const trigger =
    plan.fireAtMs === nowMs
      ? null
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE as const,
          date: new Date(plan.fireAtMs),
        };

  await Notifications.scheduleNotificationAsync({
    identifier: GRADSKI_CLOCK_END_ID,
    content: {
      title: 'Smart Park',
      body: gradskiClockEndBody(zoneCode),
      data,
      categoryIdentifier: GRADSKI_CLOCK_END_ID,
    },
    trigger,
  });
}
