// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_SECOND_REMINDER_MINUTES,
  MAX_REMINDERS_PER_STOP,
  planStopReminders,
  reminderDeliveries,
  type PlanStopRemindersInput,
} from '../../src/detection/reminders.ts';

const NOW_MS = 1_700_000_000_000;
const FIVE_MIN_MS = 5 * 60_000;

const REMINDER_ROW_KEYS = [
  'kind',
  'fireAtMs',
  'stopId',
  'zoneCode',
  'title',
  'body',
];

function baseInput(overrides: Partial<PlanStopRemindersInput> = {}): PlanStopRemindersInput {
  return {
    stopId: 'stop-abc',
    zoneCode: 'C80',
    operatorName: 'Gradski Parking',
    locale: 'en',
    nowMs: NOW_MS,
    anchorMs: null,
    scheduledCount: 0,
    secondDelayMinutes: 5,
    eligible: true,
    ...overrides,
  };
}

function assertRowShape(row: Record<string, unknown>): void {
  const keys = Object.keys(row).sort();
  const expected = [...REMINDER_ROW_KEYS].sort();
  assert.deepEqual(keys, expected);
}

describe('planStopReminders', () => {
  it('schedules first and second when count is zero and eligible', () => {
    const result = planStopReminders(
      baseInput({
        stopId: '  stop-trim  ',
        zoneCode: '  C80  ',
        scheduledCount: 0,
        locale: 'en',
        operatorName: 'Gradski Parking',
        secondDelayMinutes: 5,
      }),
    );

    assert.equal(result.cancelPending, false);
    assert.equal(result.schedule.length, 2);
    assert.equal(result.schedule[0].kind, 'first');
    assert.equal(result.schedule[1].kind, 'second');
    assert.equal(result.schedule[0].fireAtMs, NOW_MS);
    assert.equal(result.schedule[1].fireAtMs, NOW_MS + FIVE_MIN_MS);
    assert.equal(result.schedule[0].title, 'Smart Park');
    assert.equal(result.schedule[1].title, 'Smart Park');
    assert.equal(
      result.schedule[0].body,
      'Parked in C80 (Gradski Parking)? Pay now.',
    );
    assert.equal(result.schedule[0].stopId, 'stop-trim');
    assert.equal(result.schedule[0].zoneCode, 'C80');
    assert.equal(result.schedule[1].stopId, 'stop-trim');
    assert.equal(result.schedule[1].zoneCode, 'C80');
    for (const row of result.schedule) {
      assertRowShape(row);
    }
  });

  it('uses Macedonian body for mk locale with operator', () => {
    const result = planStopReminders(
      baseInput({
        locale: 'mk',
        operatorName: 'Градски паркинг',
      }),
    );
    const body = 'Паркирате во C80 (Градски паркинг)? Плати сега.';
    assert.equal(result.schedule[0].body, body);
    assert.equal(result.schedule[1].body, body);
  });

  it('omits operator in body when operator is only spaces', () => {
    const en = planStopReminders(
      baseInput({ locale: 'en', operatorName: '   ' }),
    );
    assert.equal(en.schedule[0].body, 'Parked in C80? Pay now.');

    const mk = planStopReminders(
      baseInput({ locale: 'mk', operatorName: '   ' }),
    );
    assert.equal(mk.schedule[0].body, 'Паркирате во C80? Плати сега.');
  });

  it('includes POC operator in English body without forcing Gradski', () => {
    const result = planStopReminders(
      baseInput({ locale: 'en', operatorName: 'POC' }),
    );
    assert.match(result.schedule[0].body, /POC/);
    assert.doesNotMatch(result.schedule[0].body, /Gradski/);
  });

  it('picks body language from locale rules', () => {
    const mkBody = 'Паркирате во C80 (Gradski Parking)? Плати сега.';
    const enBody = 'Parked in C80 (Gradski Parking)? Pay now.';

    for (const locale of ['mk', 'fr', '']) {
      const result = planStopReminders(baseInput({ locale }));
      assert.equal(result.schedule[0].body, mkBody);
    }

    const upperEn = planStopReminders(baseInput({ locale: 'EN' }));
    assert.equal(upperEn.schedule[0].body, mkBody);

    const lowerEn = planStopReminders(baseInput({ locale: 'en' }));
    assert.equal(lowerEn.schedule[0].body, enBody);
  });

  it('cancels when not eligible', () => {
    const result = planStopReminders(
      baseInput({
        eligible: false,
        stopId: 'real-stop',
        zoneCode: 'C80',
      }),
    );
    assert.equal(result.cancelPending, true);
    assert.deepEqual(result.schedule, []);
  });

  it('cancels when stop or zone is only spaces while eligible', () => {
    const badStop = planStopReminders(
      baseInput({ stopId: '   ', zoneCode: 'C80' }),
    );
    assert.equal(badStop.cancelPending, true);
    assert.deepEqual(badStop.schedule, []);

    const badZone = planStopReminders(
      baseInput({ stopId: 'stop-abc', zoneCode: '   ' }),
    );
    assert.equal(badZone.cancelPending, true);
    assert.deepEqual(badZone.schedule, []);
  });

  it('returns empty schedule for non-finite nowMs without cancel', () => {
    for (const nowMs of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = planStopReminders(
        baseInput({ nowMs, zoneCode: '', eligible: true }),
      );
      assert.equal(result.cancelPending, false);
      assert.deepEqual(result.schedule, []);
    }
  });

  it('treats negative scheduled count like zero', () => {
    const result = planStopReminders(baseInput({ scheduledCount: -1 }));
    assert.equal(result.cancelPending, false);
    assert.equal(result.schedule.length, 2);
    assert.equal(result.schedule[0].kind, 'first');
    assert.equal(result.schedule[1].kind, 'second');
  });

  it('schedules nothing when count already at max reminders', () => {
    for (const scheduledCount of [2, 3, 2.2]) {
      const result = planStopReminders(baseInput({ scheduledCount }));
      assert.equal(result.cancelPending, false);
      assert.deepEqual(result.schedule, []);
    }
    assert.equal(MAX_REMINDERS_PER_STOP, 2);
  });

  it('schedules only second when count is one and anchor matches now', () => {
    const result = planStopReminders(
      baseInput({
        scheduledCount: 1,
        anchorMs: NOW_MS,
        secondDelayMinutes: 5,
      }),
    );
    assert.equal(result.cancelPending, false);
    assert.equal(result.schedule.length, 1);
    assert.equal(result.schedule[0].kind, 'second');
    assert.equal(result.schedule[0].fireAtMs, NOW_MS + FIVE_MIN_MS);
    assert.equal(
      result.schedule.find((r) => r.kind === 'first'),
      undefined,
    );
  });

  it('fires second at now when count is one and anchor is null', () => {
    const result = planStopReminders(
      baseInput({ scheduledCount: 1, anchorMs: null }),
    );
    assert.equal(result.schedule.length, 1);
    assert.equal(result.schedule[0].kind, 'second');
    assert.equal(result.schedule[0].fireAtMs, NOW_MS);
  });

  it('clamps second to now when anchor plus delay is before now', () => {
    const anchorMs = NOW_MS - 10 * 60_000;
    const result = planStopReminders(
      baseInput({
        scheduledCount: 1,
        anchorMs,
        secondDelayMinutes: 5,
      }),
    );
    assert.equal(result.schedule[0].fireAtMs, NOW_MS);
  });

  it('resolves second delay minutes and asserts second fire time', () => {
    const defaultCases = [0, 181, 1.5, Number.NaN];
    for (const secondDelayMinutes of defaultCases) {
      const result = planStopReminders(
        baseInput({ scheduledCount: 0, secondDelayMinutes }),
      );
      const expected =
        NOW_MS + DEFAULT_SECOND_REMINDER_MINUTES * 60_000;
      assert.equal(result.schedule[1].fireAtMs, expected);
    }

    const keptCases: [number, number][] = [
      [10, 10 * 60_000],
      [1, 1 * 60_000],
      [180, 180 * 60_000],
    ];
    for (const [minutes, offsetMs] of keptCases) {
      const result = planStopReminders(
        baseInput({ scheduledCount: 1, anchorMs: NOW_MS, secondDelayMinutes: minutes }),
      );
      assert.equal(result.schedule[0].fireAtMs, NOW_MS + offsetMs);
    }
  });

  it('handles fractional scheduled counts', () => {
    const both = planStopReminders(baseInput({ scheduledCount: 0.5 }));
    assert.equal(both.schedule.length, 2);
    assert.equal(both.schedule[0].kind, 'first');
    assert.equal(both.schedule[1].kind, 'second');

    const secondOnly = planStopReminders(baseInput({ scheduledCount: 1.5 }));
    assert.equal(secondOnly.schedule.length, 1);
    assert.equal(secondOnly.schedule[0].kind, 'second');
  });

  it('planned rows expose only the expected keys', () => {
    const result = planStopReminders(baseInput());
    for (const row of result.schedule) {
      assertRowShape(row);
    }
  });
});

const DELIVERY_ROW_KEYS = [
  'identifier',
  'title',
  'body',
  'stopId',
  'zoneCode',
  'kind',
  'fireAtMs',
  'data',
];

function assertDeliveryShape(row: Record<string, unknown>): void {
  const keys = Object.keys(row).sort();
  const expected = [...DELIVERY_ROW_KEYS].sort();
  assert.deepEqual(keys, expected);
}

describe('reminderDeliveries', () => {
  it('maps a two-row plan to delivery payloads', () => {
    const result = planStopReminders({
      stopId: 'stop-1',
      zoneCode: 'C80',
      operatorName: '',
      locale: 'en',
      nowMs: NOW_MS,
      anchorMs: null,
      scheduledCount: 0,
      secondDelayMinutes: 5,
      eligible: true,
    });

    const deliveries = reminderDeliveries(result);

    assert.equal(deliveries.length, 2);
    assert.equal(deliveries[0].identifier, 'stop-1:first');
    assert.equal(deliveries[1].identifier, 'stop-1:second');
    assert.equal(deliveries[0].kind, 'first');
    assert.equal(deliveries[1].kind, 'second');
    assert.equal(deliveries[0].title, 'Smart Park');
    assert.equal(deliveries[1].title, 'Smart Park');
    assert.equal(deliveries[0].body, 'Parked in C80? Pay now.');
    assert.equal(deliveries[1].body, 'Parked in C80? Pay now.');
    assert.equal(deliveries[0].fireAtMs, NOW_MS);
    assert.equal(deliveries[1].fireAtMs, NOW_MS + FIVE_MIN_MS);
    assert.deepEqual(deliveries[0].data, {
      stopId: 'stop-1',
      zoneCode: 'C80',
      kind: 'first',
    });
    assert.deepEqual(deliveries[1].data, {
      stopId: 'stop-1',
      zoneCode: 'C80',
      kind: 'second',
    });
    for (const row of deliveries) {
      assertDeliveryShape(row);
      assert.deepEqual(Object.keys(row.data).sort(), ['kind', 'stopId', 'zoneCode']);
    }
  });

  it('returns empty array when schedule is empty', () => {
    const result = planStopReminders(
      baseInput({ eligible: false }),
    );
    assert.deepEqual(result.schedule, []);
    assert.deepEqual(reminderDeliveries(result), []);
  });

  it('delivery objects expose only the expected keys', () => {
    const result = planStopReminders(baseInput());
    for (const row of reminderDeliveries(result)) {
      assertDeliveryShape(row);
    }
  });
});
