export const PREPAID_EXPIRY_LEAD_MINUTES = 10;

export const PREPAID_EXPIRY_ID = 'prepaid-expiry';

export type PlanPrepaidExpiryInput = {
  paidUntilLocal: string;
  nowMs: number;
  leadMinutes?: number;
};

export type PlanPrepaidExpiryResult =
  | { fire: false }
  | { fire: true; fireAtMs: number };

export function planPrepaidExpiry({
  paidUntilLocal,
  nowMs,
  leadMinutes,
}: PlanPrepaidExpiryInput): PlanPrepaidExpiryResult {
  const paidUntilMs = Date.parse(paidUntilLocal);
  if (!Number.isFinite(paidUntilMs) || paidUntilMs <= nowMs) {
    return { fire: false };
  }

  let lead = leadMinutes ?? PREPAID_EXPIRY_LEAD_MINUTES;
  if (!Number.isInteger(lead) || lead < 1 || lead > 180) {
    lead = PREPAID_EXPIRY_LEAD_MINUTES;
  }

  let fireAtMs = paidUntilMs - lead * 60_000;
  if (fireAtMs < nowMs) {
    fireAtMs = nowMs;
  }

  return { fire: true, fireAtMs };
}
