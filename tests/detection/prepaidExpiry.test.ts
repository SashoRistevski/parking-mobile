// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PREPAID_EXPIRY_LEAD_MINUTES,
  planPrepaidExpiry,
} from '../../src/detection/prepaidExpiry.ts';

const NOW_MS = 1_700_000_000_000;
const MIN_MS = 60_000;

function paidUntilLocalFromNow(nowMs: number, minutesAhead: number): string {
  return new Date(nowMs + minutesAhead * MIN_MS).toISOString();
}

describe('PREPAID_EXPIRY_LEAD_MINUTES', () => {
  it('is 10', () => {
    assert.equal(PREPAID_EXPIRY_LEAD_MINUTES, 10);
  });
});

describe('planPrepaidExpiry', () => {
  it('returns fire false when paidUntilLocal does not parse', () => {
    const result = planPrepaidExpiry({
      paidUntilLocal: 'not-a-date',
      nowMs: NOW_MS,
    });
    assert.deepEqual(result, { fire: false });
  });

  it('returns fire false when paid-until equals nowMs', () => {
    const paidUntilLocal = new Date(NOW_MS).toISOString();
    const result = planPrepaidExpiry({ paidUntilLocal, nowMs: NOW_MS });
    assert.deepEqual(result, { fire: false });
  });

  it('returns fire false when paid-until is before nowMs', () => {
    const paidUntilLocal = paidUntilLocalFromNow(NOW_MS, -5);
    const result = planPrepaidExpiry({ paidUntilLocal, nowMs: NOW_MS });
    assert.deepEqual(result, { fire: false });
  });

  it('fires 20 minutes after now when paid-until is 30 minutes ahead and lead is omitted', () => {
    const paidUntilLocal = paidUntilLocalFromNow(NOW_MS, 30);
    const result = planPrepaidExpiry({ paidUntilLocal, nowMs: NOW_MS });
    assert.deepEqual(result, {
      fire: true,
      fireAtMs: NOW_MS + 20 * MIN_MS,
    });
  });

  it('fires at now when paid-until is only 5 minutes ahead', () => {
    const paidUntilLocal = paidUntilLocalFromNow(NOW_MS, 5);
    const result = planPrepaidExpiry({ paidUntilLocal, nowMs: NOW_MS });
    assert.deepEqual(result, { fire: true, fireAtMs: NOW_MS });
  });

  it('uses explicit leadMinutes when valid', () => {
    const paidUntilLocal = paidUntilLocalFromNow(NOW_MS, 30);
    const result = planPrepaidExpiry({
      paidUntilLocal,
      nowMs: NOW_MS,
      leadMinutes: 15,
    });
    assert.deepEqual(result, {
      fire: true,
      fireAtMs: NOW_MS + 15 * MIN_MS,
    });
  });

  it('falls back to default lead for 0, 181, and 1.5', () => {
    const paidUntilLocal = paidUntilLocalFromNow(NOW_MS, 30);
    const expected = {
      fire: true,
      fireAtMs: NOW_MS + 20 * MIN_MS,
    };
    for (const leadMinutes of [0, 181, 1.5]) {
      const result = planPrepaidExpiry({
        paidUntilLocal,
        nowMs: NOW_MS,
        leadMinutes,
      });
      assert.deepEqual(result, expected);
    }
  });
});
