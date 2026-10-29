export const STILL_PARKED_AFTER_HOURS = 3;
export const STILL_PARKED_ID = 'still-parked';

export type PlanStillParkedInput = {
  startedAt: string;
  nowMs: number;
  afterHours?: number;
};

export type PlanStillParkedResult =
  | { fire: false }
  | { fire: true; fireAtMs: number };

function normalizeAfterHours(afterHours: number | undefined): number {
  if (
    typeof afterHours === 'number' &&
    Number.isInteger(afterHours) &&
    afterHours >= 1 &&
    afterHours <= 24
  ) {
    return afterHours;
  }
  return STILL_PARKED_AFTER_HOURS;
}

export function planStillParked(input: PlanStillParkedInput): PlanStillParkedResult {
  const startedMs = Date.parse(input.startedAt);
  if (!Number.isFinite(startedMs) || !Number.isFinite(input.nowMs)) {
    return { fire: false };
  }
  const hours = normalizeAfterHours(input.afterHours);
  const fireAtMs = startedMs + hours * 60 * 60 * 1000;
  if (fireAtMs > input.nowMs) {
    return { fire: true, fireAtMs };
  }
  return { fire: true, fireAtMs: input.nowMs };
}
