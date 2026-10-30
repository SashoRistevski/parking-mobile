export const REMINDER_CATEGORY_ID = 'parked-unpaid';

export const REMINDER_ACTION_IDS = [
  'pay-now',
  'already-paid',
  'snooze',
  'not-parking',
  'ignore-place',
] as const;

export type ReminderActionId = (typeof REMINDER_ACTION_IDS)[number];

export type ReminderActionDecision =
  | 'open-pay'
  | 'cancel'
  | 'snooze'
  | 'mark-sent'
  | 'false-positive'
  | 'ignore-place';

const DEFAULT_TAP_ACTION = 'expo.modules.notifications.actions.DEFAULT';

const BUTTON_TITLES: Record<ReminderActionId, { en: string; mk: string }> = {
  'pay-now': { en: 'Pay now', mk: 'Плати сега' },
  'already-paid': { en: 'I already paid', mk: 'Веќе платив' },
  snooze: { en: 'Remind me in 5 min', mk: 'Потсети ме за 5 мин' },
  'not-parking': { en: 'Not parking', mk: 'Не паркирам' },
  'ignore-place': { en: 'Ignore this place', mk: 'Игнорирај го ова место' },
};

export function reminderActionButtons(
  locale: string,
): { identifier: string; buttonTitle: string }[] {
  const lang = locale === 'en' ? 'en' : 'mk';
  return REMINDER_ACTION_IDS.map((id) => ({
    identifier: id,
    buttonTitle: BUTTON_TITLES[id][lang],
  }));
}

export function decideReminderAction(actionIdentifier: string): ReminderActionDecision {
  if (actionIdentifier === 'pay-now' || actionIdentifier === DEFAULT_TAP_ACTION) {
    return 'open-pay';
  }
  if (actionIdentifier === 'snooze') {
    return 'snooze';
  }
  if (actionIdentifier === 'already-paid') {
    return 'mark-sent';
  }
  if (actionIdentifier === 'not-parking') {
    return 'false-positive';
  }
  if (actionIdentifier === 'ignore-place') {
    return 'ignore-place';
  }
  return 'open-pay';
}

const listeners = new Set<(line: string) => void>();

export function subscribeReminderLog(listener: (line: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type AlreadyPaidPaymentModel = 'prepaid' | 'session' | null;

export type AlreadyPaidVehicleInput = {
  id: number;
  default_park_time: number | null;
};

export type AlreadyPaidPointInput = {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
};

export type BuildAlreadyPaidStartFailureReason = 'missing-point' | 'no-vehicle';

export type AlreadyPaidStartBody = {
  vehicle_id: number;
  lat: number;
  lng: number;
  accuracy_m?: number;
  hours?: number;
};

export type BuildAlreadyPaidStartResult =
  | { ok: false; reason: BuildAlreadyPaidStartFailureReason }
  | { ok: true; body: AlreadyPaidStartBody };

export function buildAlreadyPaidStart(
  point: AlreadyPaidPointInput | null | undefined,
  _zoneCode: string,
  vehicle: AlreadyPaidVehicleInput | null | undefined,
  paymentModel: AlreadyPaidPaymentModel,
): BuildAlreadyPaidStartResult {
  if (
    !point ||
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude)
  ) {
    return { ok: false, reason: 'missing-point' };
  }
  if (!vehicle) {
    return { ok: false, reason: 'no-vehicle' };
  }

  const body: AlreadyPaidStartBody = {
    vehicle_id: vehicle.id,
    lat: point.latitude,
    lng: point.longitude,
  };

  const accuracyM = point.accuracyM;
  if (
    typeof accuracyM === 'number' &&
    Number.isFinite(accuracyM) &&
    accuracyM >= 0 &&
    accuracyM <= 100
  ) {
    body.accuracy_m = accuracyM;
  }

  if (paymentModel === 'prepaid') {
    const hours = vehicle.default_park_time;
    if (
      typeof hours === 'number' &&
      Number.isInteger(hours) &&
      hours >= 1 &&
      hours <= 24
    ) {
      body.hours = hours;
    } else {
      body.hours = 1;
    }
  }

  return { ok: true, body };
}

export function emitReminderLog(line: string): void {
  for (const listener of listeners) {
    try {
      listener(line);
    } catch {
      // ignore listener errors
    }
  }
}
