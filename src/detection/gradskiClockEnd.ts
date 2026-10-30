export const GRADSKI_CLOCK_END_ID = 'gradski-clock-end';

export type PlanGradskiClockEndInput = {
  endsAt: string;
  nowMs: number;
};

export type PlanGradskiClockEndResult =
  | { fire: false }
  | { fire: true; fireAtMs: number };

function skopjeDateAndTime(atMs: number): { date: string; time: string } {
  const instant = new Date(atMs);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Skopje',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Skopje',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);

  const hour = timeParts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = timeParts.find((p) => p.type === 'minute')?.value ?? '00';
  const second = timeParts.find((p) => p.type === 'second')?.value ?? '00';
  const time = `${hour}:${minute}:${second}`;
  return { date, time };
}

function parseWallClock(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? '0');
  if (
    !Number.isFinite(hours) ||
    hours < 0 ||
    hours > 23 ||
    !Number.isFinite(minutes) ||
    minutes < 0 ||
    minutes > 59 ||
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function skopjeWallClockOnDateMs(nowMs: number, clock: string): number | null {
  const targetTime = parseWallClock(clock);
  if (!targetTime) {
    return null;
  }
  const targetDate = skopjeDateAndTime(nowMs).date;
  const targetKey = `${targetDate}\0${targetTime}`;

  let lo = nowMs - 48 * 3600000;
  let hi = nowMs + 48 * 3600000;
  let found: number | null = null;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { date, time } = skopjeDateAndTime(mid);
    const key = `${date}\0${time}`;
    if (key === targetKey) {
      found = mid;
      break;
    }
    if (key < targetKey) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return found;
}

const WALL_CLOCK_SHAPE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

function resolveEndMs(endsAt: string, nowMs: number): number | null {
  const trimmed = endsAt.trim();
  if (WALL_CLOCK_SHAPE.test(trimmed)) {
    return skopjeWallClockOnDateMs(nowMs, trimmed);
  }
  if (trimmed.includes('T') || ISO_DATE_PREFIX.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function planGradskiClockEnd(
  input: PlanGradskiClockEndInput,
): PlanGradskiClockEndResult {
  const { endsAt, nowMs } = input;
  if (typeof endsAt !== 'string' || endsAt.trim().length === 0) {
    return { fire: false };
  }
  if (!Number.isFinite(nowMs)) {
    return { fire: false };
  }

  const endMs = resolveEndMs(endsAt, nowMs);
  if (endMs === null) {
    return { fire: false };
  }

  if (endMs > nowMs) {
    return { fire: true, fireAtMs: endMs };
  }
  return { fire: true, fireAtMs: nowMs };
}
