// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STILL_PARKED_AFTER_HOURS,
  planStillParked,
} from '../../src/detection/stillParked.ts';

const NOW_MS = 1_700_000_000_000;
const HOUR_MS = 60 * 60 * 1000;

function startedAtFromNow(nowMs: number, hoursOffset: number): string {
  return new Date(nowMs + hoursOffset * HOUR_MS).toISOString();
}

describe('STILL_PARKED_AFTER_HOURS', () => {
  it('is 3', () => {
    assert.equal(STILL_PARKED_AFTER_HOURS, 3);
  });
});

describe('planStillParked', () => {
  it('returns fire false when startedAt does not parse', () => {
    const result = planStillParked({
      startedAt: 'not-a-date',
      nowMs: NOW_MS,
    });
    assert.deepEqual(result, { fire: false });
  });

  it('returns fire false when nowMs is not finite', () => {
    const startedAt = new Date(NOW_MS).toISOString();
    for (const nowMs of [NaN, Infinity, -Infinity]) {
      const result = planStillParked({ startedAt, nowMs });
      assert.deepEqual(result, { fire: false });
    }
  });

  it('fires at nowMs plus 3 hours when start equals nowMs and afterHours is omitted', () => {
    const startedAt = new Date(NOW_MS).toISOString();
    const result = planStillParked({ startedAt, nowMs: NOW_MS });
    assert.deepEqual(result, {
      fire: true,
      fireAtMs: NOW_MS + 3 * HOUR_MS,
    });
  });

  it('fires at nowMs plus 2 hours when start is 1 hour before nowMs', () => {
    const startedAt = startedAtFromNow(NOW_MS, -1);
    const result = planStillParked({ startedAt, nowMs: NOW_MS });
    assert.deepEqual(result, {
      fire: true,
      fireAtMs: NOW_MS + 2 * HOUR_MS,
    });
  });

  it('fires at nowMs when start is 4 hours before nowMs', () => {
    const startedAt = startedAtFromNow(NOW_MS, -4);
    const result = planStillParked({ startedAt, nowMs: NOW_MS });
    assert.deepEqual(result, {
      fire: true,
      fireAtMs: NOW_MS,
    });
  });

  it('uses explicit afterHours when valid', () => {
    const startedAt = new Date(NOW_MS).toISOString();
    const result = planStillParked({
      startedAt,
      nowMs: NOW_MS,
      afterHours: 5,
    });
    assert.deepEqual(result, {
      fire: true,
      fireAtMs: NOW_MS + 5 * HOUR_MS,
    });
  });

  it('falls back to default afterHours for 0, 25, and 1.5', () => {
    const startedAt = new Date(NOW_MS).toISOString();
    const expected = {
      fire: true,
      fireAtMs: NOW_MS + 3 * HOUR_MS,
    };
    for (const afterHours of [0, 25, 1.5]) {
      const result = planStillParked({
        startedAt,
        nowMs: NOW_MS,
        afterHours,
      });
      assert.deepEqual(result, expected);
    }
  });
});
