// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planConfirmNag } from '../../src/auth/confirmNag.ts';

const NOW_MS = 1_700_000_000_000;
const DAY_MS = 86_400_000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const TODAY = '2026-10-28';

function createdAtFromNow(nowMs: number, msBeforeNow: number): string {
  return new Date(nowMs - msBeforeNow).toISOString();
}

describe('planConfirmNag', () => {
  it('returns both flags false when email is verified even for a new account', () => {
    const result = planConfirmNag({
      emailVerifiedAt: '2026-10-28T00:00:00.000Z',
      createdAt: createdAtFromNow(NOW_MS, DAY_MS),
      nowMs: NOW_MS,
      lastNagDate: undefined,
      today: TODAY,
    });
    assert.deepEqual(result, { showBanner: false, showNag: false });
  });

  it('treats null and empty emailVerifiedAt as unconfirmed', () => {
    const createdAt = createdAtFromNow(NOW_MS, SEVEN_DAYS_MS - 1);
    for (const emailVerifiedAt of [null, '']) {
      const result = planConfirmNag({
        emailVerifiedAt,
        createdAt,
        nowMs: NOW_MS,
        lastNagDate: undefined,
        today: TODAY,
      });
      assert.deepEqual(result, { showBanner: true, showNag: true });
    }
  });

  it('returns both flags false when createdAt does not parse', () => {
    const result = planConfirmNag({
      emailVerifiedAt: null,
      createdAt: 'nope',
      nowMs: NOW_MS,
      lastNagDate: undefined,
      today: TODAY,
    });
    assert.deepEqual(result, { showBanner: false, showNag: false });
  });

  it('returns both flags false when nowMs is not finite', () => {
    const createdAt = createdAtFromNow(NOW_MS, DAY_MS);
    for (const nowMs of [NaN, Infinity, -Infinity]) {
      const result = planConfirmNag({
        emailVerifiedAt: null,
        createdAt,
        nowMs,
        lastNagDate: undefined,
        today: TODAY,
      });
      assert.deepEqual(result, { showBanner: false, showNag: false });
    }
  });

  it('returns both flags false when account age is exactly seven days', () => {
    const result = planConfirmNag({
      emailVerifiedAt: null,
      createdAt: createdAtFromNow(NOW_MS, SEVEN_DAYS_MS),
      nowMs: NOW_MS,
      lastNagDate: undefined,
      today: TODAY,
    });
    assert.deepEqual(result, { showBanner: false, showNag: false });
  });

  it('returns showBanner true when account is one ms younger than seven days', () => {
    const createdAt = createdAtFromNow(NOW_MS, SEVEN_DAYS_MS - 1);
    const result = planConfirmNag({
      emailVerifiedAt: null,
      createdAt,
      nowMs: NOW_MS,
      lastNagDate: undefined,
      today: TODAY,
    });
    assert.deepEqual(result, { showBanner: true, showNag: true });
  });

  it('returns showNag false when lastNagDate equals today', () => {
    const createdAt = createdAtFromNow(NOW_MS, SEVEN_DAYS_MS - 1);
    const result = planConfirmNag({
      emailVerifiedAt: null,
      createdAt,
      nowMs: NOW_MS,
      lastNagDate: TODAY,
      today: TODAY,
    });
    assert.deepEqual(result, { showBanner: true, showNag: false });
  });

  it('returns showNag true when lastNagDate is yesterday or missing', () => {
    const createdAt = createdAtFromNow(NOW_MS, SEVEN_DAYS_MS - 1);
    for (const lastNagDate of ['2026-10-27', undefined, null]) {
      const result = planConfirmNag({
        emailVerifiedAt: null,
        createdAt,
        nowMs: NOW_MS,
        lastNagDate,
        today: TODAY,
      });
      assert.deepEqual(result, { showBanner: true, showNag: true });
    }
  });
});
