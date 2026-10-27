// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type Holiday,
  type ZoneFeature,
  type ZoneTodayWindow,
  paidNow,
  zoneAt,
} from '../../src/detection/zone.ts';

const C80_RING: number[][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

const C81_RING: number[][] = [
  [0.4, 0.4],
  [0.6, 0.4],
  [0.6, 0.6],
  [0.4, 0.6],
  [0.4, 0.4],
];

function feature(
  ring: number[][],
  code: string,
  today: ZoneTodayWindow | null = { starts_at: '07:00:00', ends_at: '21:00:00' },
): ZoneFeature {
  return {
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: { code, today },
  };
}

const zones: ZoneFeature[] = [feature(C80_RING, 'C80'), feature(C81_RING, 'C81')];

describe('zoneAt', () => {
  it('1: centre of C80 square is C80, not ambiguous, accuracy 0', () => {
    const result = zoneAt([feature(C80_RING, 'C80')], 0.5, 0.5, 0);
    assert.equal(result.zoneCode, 'C80');
    assert.equal(result.ambiguous, false);
  });

  it('2: point at longitude 5, latitude 5 is null and not ambiguous', () => {
    const result = zoneAt(zones, 5, 5, 0);
    assert.equal(result.zoneCode, null);
    assert.equal(result.ambiguous, false);
  });

  it('3: point on edge (longitude 0, latitude 0.5) is C80', () => {
    const result = zoneAt(zones, 0.5, 0, 0);
    assert.equal(result.zoneCode, 'C80');
    assert.equal(result.ambiguous, false);
  });

  it('4: point inside both squares is C81 (smaller wins)', () => {
    const result = zoneAt(zones, 0.5, 0.5, 0);
    assert.equal(result.zoneCode, 'C81');
    assert.equal(result.ambiguous, false);
  });

  it('5: just inside east edge with large accuracy is ambiguous and still C80', () => {
    const result = zoneAt([feature(C80_RING, 'C80')], 0.5, 0.999, 5000);
    assert.equal(result.zoneCode, 'C80');
    assert.equal(result.ambiguous, true);
  });
});

describe('paidNow', () => {
  const c80 = feature(C80_RING, 'C80');
  const a0 = feature(C80_RING, 'A0');
  const noHolidays: Holiday[] = [];

  it('6: Wednesday 08:00 Skopje with today window is paid', () => {
    const atMs = Date.parse('2026-01-07T07:00:00.000Z');
    assert.equal(paidNow(c80, atMs, noHolidays), true);
  });

  it('7a: Wednesday 06:00 Skopje is not paid', () => {
    const atMs = Date.parse('2026-01-07T05:00:00.000Z');
    assert.equal(paidNow(c80, atMs, noHolidays), false);
  });

  it('7b: Wednesday 21:00 Skopje is not paid', () => {
    const atMs = Date.parse('2026-01-07T20:00:00.000Z');
    assert.equal(paidNow(c80, atMs, noHolidays), false);
  });

  it('8: today null on Wednesday is not paid', () => {
    const noToday = feature(C80_RING, 'C80', null);
    const atMs = Date.parse('2026-01-07T07:00:00.000Z');
    assert.equal(paidNow(noToday, atMs, noHolidays), false);
  });

  it('9: Sunday 10:00 Skopje C80 is not paid even with today window', () => {
    const atMs = Date.parse('2026-01-11T09:00:00.000Z');
    assert.equal(paidNow(c80, atMs, noHolidays), false);
  });

  it('10a: Sunday 10:00 Skopje A0 is paid', () => {
    const atMs = Date.parse('2026-01-11T09:00:00.000Z');
    assert.equal(paidNow(a0, atMs, noHolidays), true);
  });

  it('10b: Sunday 16:00 Skopje A0 is not paid', () => {
    const atMs = Date.parse('2026-01-11T15:00:00.000Z');
    assert.equal(paidNow(a0, atMs, noHolidays), false);
  });

  it('10c: Sunday 08:00 Skopje A0 is not paid', () => {
    const atMs = Date.parse('2026-01-11T07:00:00.000Z');
    assert.equal(paidNow(a0, atMs, noHolidays), false);
  });

  it('11a: holiday Wednesday C80 is not paid', () => {
    const atMs = Date.parse('2026-01-07T07:00:00.000Z');
    const holidays: Holiday[] = [{ date: '2026-01-07' }];
    assert.equal(paidNow(c80, atMs, holidays), false);
  });

  it('11b: holiday Wednesday A0 at 10:00 Skopje is paid', () => {
    const atMs = Date.parse('2026-01-07T09:00:00.000Z');
    const holidays: Holiday[] = [{ date: '2026-01-07' }];
    assert.equal(paidNow(a0, atMs, holidays), true);
  });
});
