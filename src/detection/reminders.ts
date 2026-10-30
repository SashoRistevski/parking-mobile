export const DEFAULT_SECOND_REMINDER_MINUTES = 5;
export const MAX_REMINDERS_PER_STOP = 2;

export type PlanStopRemindersInput = {
  stopId: string;
  zoneCode: string;
  operatorName: string;
  locale: string;
  nowMs: number;
  anchorMs: number | null;
  scheduledCount: number;
  secondDelayMinutes: number;
  eligible: boolean;
};

export type PlannedReminder = {
  kind: 'first' | 'second';
  fireAtMs: number;
  stopId: string;
  zoneCode: string;
  title: string;
  body: string;
};

export type PlanStopRemindersResult = {
  cancelPending: boolean;
  schedule: PlannedReminder[];
};

const TITLE = 'Smart Park';

function resolveDelayMinutes(secondDelayMinutes: number): number {
  if (
    Number.isInteger(secondDelayMinutes) &&
    secondDelayMinutes >= 1 &&
    secondDelayMinutes <= 180
  ) {
    return secondDelayMinutes;
  }
  return DEFAULT_SECOND_REMINDER_MINUTES;
}

function buildBody(locale: string, zoneCode: string, operatorName: string): string {
  const operator = operatorName.trim();
  if (locale === 'en') {
    if (operator) {
      return `Parked in ${zoneCode} (${operator})? Pay now.`;
    }
    return `Parked in ${zoneCode}? Pay now.`;
  }
  if (operator) {
    return `Паркирате во ${zoneCode} (${operator})? Плати сега.`;
  }
  return `Паркирате во ${zoneCode}? Плати сега.`;
}

function clampScheduledCount(scheduledCount: number): number {
  let count = scheduledCount;
  if (!Number.isFinite(count) || count < 0) {
    count = 0;
  }
  if (count > MAX_REMINDERS_PER_STOP) {
    count = MAX_REMINDERS_PER_STOP;
  }
  return count;
}

function makeReminder(
  kind: 'first' | 'second',
  fireAtMs: number,
  stopId: string,
  zoneCode: string,
  body: string,
): PlannedReminder {
  return {
    kind,
    fireAtMs,
    stopId,
    zoneCode,
    title: TITLE,
    body,
  };
}

export function planStopReminders(input: PlanStopRemindersInput): PlanStopRemindersResult {
  if (!Number.isFinite(input.nowMs)) {
    return { cancelPending: false, schedule: [] };
  }

  const stopId = input.stopId.trim();
  const zoneCode = input.zoneCode.trim();
  if (!stopId || !zoneCode) {
    return { cancelPending: true, schedule: [] };
  }

  if (!input.eligible) {
    return { cancelPending: true, schedule: [] };
  }

  const count = clampScheduledCount(input.scheduledCount);
  if (count >= MAX_REMINDERS_PER_STOP) {
    return { cancelPending: false, schedule: [] };
  }

  const delayMs = resolveDelayMinutes(input.secondDelayMinutes) * 60_000;
  const body = buildBody(input.locale, zoneCode, input.operatorName);
  const nowMs = input.nowMs;

  if (count < 1) {
    return {
      cancelPending: false,
      schedule: [
        makeReminder('first', nowMs, stopId, zoneCode, body),
        makeReminder('second', nowMs + delayMs, stopId, zoneCode, body),
      ],
    };
  }

  let secondFireAtMs = nowMs;
  const anchorMs = input.anchorMs;
  if (anchorMs !== null && Number.isFinite(anchorMs)) {
    secondFireAtMs = anchorMs + delayMs;
    if (secondFireAtMs < nowMs) {
      secondFireAtMs = nowMs;
    }
  }

  return {
    cancelPending: false,
    schedule: [makeReminder('second', secondFireAtMs, stopId, zoneCode, body)],
  };
}

export type ReminderNotificationData = {
  stopId: string;
  zoneCode: string;
  kind: 'first' | 'second';
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
};

export type ReminderDelivery = {
  identifier: string;
  title: string;
  body: string;
  stopId: string;
  zoneCode: string;
  kind: 'first' | 'second';
  fireAtMs: number;
  data: ReminderNotificationData;
};

export function reminderDeliveries(result: PlanStopRemindersResult): ReminderDelivery[] {
  if (result.schedule.length === 0) {
    return [];
  }
  return result.schedule.map((row) => ({
    identifier: `${row.stopId}:${row.kind}`,
    title: row.title,
    body: row.body,
    stopId: row.stopId,
    zoneCode: row.zoneCode,
    kind: row.kind,
    fireAtMs: row.fireAtMs,
    data: {
      stopId: row.stopId,
      zoneCode: row.zoneCode,
      kind: row.kind,
    },
  }));
}
