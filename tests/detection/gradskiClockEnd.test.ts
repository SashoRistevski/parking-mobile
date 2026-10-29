// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planGradskiClockEnd } from '../../src/detection/gradskiClockEnd.ts';

const SKOPJE_NOON_UTC_MS = Date.parse('2026-07-15T10:00:00Z');
const SKOPJE_21_00_AS_UTC_MS = Date.parse('2026-07-15T19:00:00Z');
const MIN_MS = 60_000;

describe('planGradskiClockEnd', () => {
  it('returns fire false for blank, whitespace-only, or unparsable endsAt', () => {
    for (const endsAt of ['', '   ', 'nope']) {
      assert.deepEqual(
        planGradskiClockEnd({ endsAt, nowMs: SKOPJE_NOON_UTC_MS }),
        { fire: false },
      );
    }
  });

  it('returns fire false when nowMs is not finite', () => {
    for (const nowMs of [NaN, Infinity, -Infinity]) {
      assert.deepEqual(
        planGradskiClockEnd({ endsAt: '21:00', nowMs }),
        { fire: false },
      );
    }
  });

  it('fires at the parsed ISO instant when endsAt is 30 minutes after nowMs', () => {
    const nowMs = SKOPJE_NOON_UTC_MS;
    const endsAt = new Date(nowMs + 30 * MIN_MS).toISOString();
    assert.deepEqual(planGradskiClockEnd({ endsAt, nowMs }), {
      fire: true,
      fireAtMs: Date.parse(endsAt),
    });
  });

  it('fires at nowMs when endsAt ISO equals nowMs or is 5 minutes before nowMs', () => {
    const nowMs = SKOPJE_NOON_UTC_MS;
    const atNow = new Date(nowMs).toISOString();
    const fiveBefore = new Date(nowMs - 5 * MIN_MS).toISOString();
    assert.deepEqual(planGradskiClockEnd({ endsAt: atNow, nowMs }), {
      fire: true,
      fireAtMs: nowMs,
    });
    assert.deepEqual(planGradskiClockEnd({ endsAt: fiveBefore, nowMs }), {
      fire: true,
      fireAtMs: nowMs,
    });
  });

  it('fires at 21:00 Europe/Skopje on the Skopje calendar date of nowMs', () => {
    assert.deepEqual(
      planGradskiClockEnd({ endsAt: '21:00', nowMs: SKOPJE_NOON_UTC_MS }),
      { fire: true, fireAtMs: SKOPJE_21_00_AS_UTC_MS },
    );
  });

  it('fires at nowMs when wall-clock endsAt is already past in Skopje', () => {
    assert.deepEqual(
      planGradskiClockEnd({ endsAt: '09:00:00', nowMs: SKOPJE_NOON_UTC_MS }),
      { fire: true, fireAtMs: SKOPJE_NOON_UTC_MS },
    );
  });

  it('returns fire false for invalid wall-clock values 24:00 and 21:99', () => {
    for (const endsAt of ['24:00', '21:99']) {
      assert.deepEqual(
        planGradskiClockEnd({ endsAt, nowMs: SKOPJE_NOON_UTC_MS }),
        { fire: false },
      );
    }
  });
});
