const DEFAULT_SECOND_REMINDER_MINUTES = 5;
const PREPAID_EXPIRY_LEAD_MINUTES = 10;
const STILL_PARKED_AFTER_HOURS = 3;

export type ReminderDelays = {
  secondReminderMinutes: number;
  prepaidExpiryLeadMinutes: number;
  stillParkedAfterHours: number;
};

export type ReminderDelaysUpdate = Partial<ReminderDelays>;

export function remindersEnabledFromStored(value: unknown): boolean {
  if (
    value &&
    typeof value === 'object' &&
    (value as { enabled?: unknown }).enabled === false
  ) {
    return false;
  }
  return true;
}

export function removeIgnoredSpot<T>(spots: T[], index: number): T[] {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= spots.length
  ) {
    return spots;
  }
  return [...spots.slice(0, index), ...spots.slice(index + 1)];
}

function clampSecondReminderMinutes(value: unknown): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 180
  ) {
    return value;
  }
  return DEFAULT_SECOND_REMINDER_MINUTES;
}

function clampPrepaidExpiryLeadMinutes(value: unknown): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 180
  ) {
    return value;
  }
  return PREPAID_EXPIRY_LEAD_MINUTES;
}

function clampStillParkedAfterHours(value: unknown): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 24
  ) {
    return value;
  }
  return STILL_PARKED_AFTER_HOURS;
}

export function reminderDelaysFromStored(value: unknown): ReminderDelays {
  if (!value || typeof value !== 'object') {
    return {
      secondReminderMinutes: DEFAULT_SECOND_REMINDER_MINUTES,
      prepaidExpiryLeadMinutes: PREPAID_EXPIRY_LEAD_MINUTES,
      stillParkedAfterHours: STILL_PARKED_AFTER_HOURS,
    };
  }
  const stored = value as {
    secondReminderMinutes?: unknown;
    prepaidExpiryLeadMinutes?: unknown;
    stillParkedAfterHours?: unknown;
  };
  return {
    secondReminderMinutes: clampSecondReminderMinutes(
      stored.secondReminderMinutes,
    ),
    prepaidExpiryLeadMinutes: clampPrepaidExpiryLeadMinutes(
      stored.prepaidExpiryLeadMinutes,
    ),
    stillParkedAfterHours: clampStillParkedAfterHours(
      stored.stillParkedAfterHours,
    ),
  };
}

export function applyReminderDelaysUpdate(
  current: ReminderDelays,
  update: ReminderDelaysUpdate,
): ReminderDelays {
  return {
    secondReminderMinutes:
      update.secondReminderMinutes !== undefined
        ? clampSecondReminderMinutes(update.secondReminderMinutes)
        : current.secondReminderMinutes,
    prepaidExpiryLeadMinutes:
      update.prepaidExpiryLeadMinutes !== undefined
        ? clampPrepaidExpiryLeadMinutes(update.prepaidExpiryLeadMinutes)
        : current.prepaidExpiryLeadMinutes,
    stillParkedAfterHours:
      update.stillParkedAfterHours !== undefined
        ? clampStillParkedAfterHours(update.stillParkedAfterHours)
        : current.stillParkedAfterHours,
  };
}
