export type PlanConfirmNagInput = {
  emailVerifiedAt: string | null;
  createdAt: string;
  nowMs: number;
  lastNagDate: string | null | undefined;
  today: string;
};

export type PlanConfirmNagResult = {
  showBanner: boolean;
  showNag: boolean;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function planConfirmNag(input: PlanConfirmNagInput): PlanConfirmNagResult {
  const { emailVerifiedAt, createdAt, nowMs, lastNagDate, today } = input;

  if (emailVerifiedAt != null && emailVerifiedAt !== '') {
    return { showBanner: false, showNag: false };
  }

  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs) || !Number.isFinite(nowMs)) {
    return { showBanner: false, showNag: false };
  }

  if (nowMs - createdMs >= SEVEN_DAYS_MS) {
    return { showBanner: false, showNag: false };
  }

  return {
    showBanner: true,
    showNag: lastNagDate !== today,
  };
}
