// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAlreadyPaidStart,
  decideReminderAction,
  emitReminderLog,
  reminderActionButtons,
  subscribeReminderLog,
} from '../../src/detection/reminderActions.ts';

const EN_BUTTONS = [
  { identifier: 'pay-now', buttonTitle: 'Pay now' },
  { identifier: 'already-paid', buttonTitle: 'I already paid' },
  { identifier: 'snooze', buttonTitle: 'Remind me in 5 min' },
  { identifier: 'not-parking', buttonTitle: 'Not parking' },
  { identifier: 'ignore-place', buttonTitle: 'Ignore this place' },
];

const MK_BUTTONS = [
  { identifier: 'pay-now', buttonTitle: 'Плати сега' },
  { identifier: 'already-paid', buttonTitle: 'Веќе платив' },
  { identifier: 'snooze', buttonTitle: 'Потсети ме за 5 мин' },
  { identifier: 'not-parking', buttonTitle: 'Не паркирам' },
  { identifier: 'ignore-place', buttonTitle: 'Игнорирај го ова место' },
];

describe('reminderActionButtons', () => {
  it('returns five English rows in order for en locale', () => {
    const rows = reminderActionButtons('en');
    assert.equal(rows.length, 5);
    assert.deepEqual(rows, EN_BUTTONS);
  });

  it('returns Macedonian rows for mk, EN, and empty locale', () => {
    for (const locale of ['mk', 'EN', '']) {
      const rows = reminderActionButtons(locale);
      assert.equal(rows.length, 5);
      assert.deepEqual(rows, MK_BUTTONS);
    }
  });
});

describe('decideReminderAction', () => {
  it('maps pay-now and default tap to open-pay', () => {
    assert.equal(decideReminderAction('pay-now'), 'open-pay');
    assert.equal(
      decideReminderAction('expo.modules.notifications.actions.DEFAULT'),
      'open-pay',
    );
  });

  it('maps snooze to snooze', () => {
    assert.equal(decideReminderAction('snooze'), 'snooze');
  });

  it('maps already-paid to mark-sent', () => {
    assert.equal(decideReminderAction('already-paid'), 'mark-sent');
  });

  it('maps not-parking to false-positive', () => {
    assert.equal(decideReminderAction('not-parking'), 'false-positive');
  });

  it('maps ignore-place to ignore-place', () => {
    assert.equal(decideReminderAction('ignore-place'), 'ignore-place');
  });

  it('maps unknown identifiers to open-pay', () => {
    assert.equal(decideReminderAction('something-else'), 'open-pay');
  });
});

const VEHICLE = { id: 42, default_park_time: 3 };
const POINT = { latitude: 41.99, longitude: 21.43 };

describe('buildAlreadyPaidStart', () => {
  it('returns missing-point when point is absent or coordinates are non-finite', () => {
    for (const point of [null, undefined]) {
      const result = buildAlreadyPaidStart(point, 'C80', VEHICLE, 'prepaid');
      assert.deepEqual(result, { ok: false, reason: 'missing-point' });
    }

    for (const point of [
      { latitude: Number.NaN, longitude: 21 },
      { latitude: 41, longitude: Number.POSITIVE_INFINITY },
      { latitude: Number.NEGATIVE_INFINITY, longitude: 21 },
    ]) {
      const result = buildAlreadyPaidStart(point, 'C80', VEHICLE, 'prepaid');
      assert.deepEqual(result, { ok: false, reason: 'missing-point' });
    }
  });

  it('returns no-vehicle when vehicle is absent', () => {
    for (const vehicle of [null, undefined]) {
      const result = buildAlreadyPaidStart(POINT, 'C80', vehicle, 'prepaid');
      assert.deepEqual(result, { ok: false, reason: 'no-vehicle' });
    }
  });

  it('builds body with vehicle_id, lat, and lng only (no zone_id)', () => {
    const result = buildAlreadyPaidStart(POINT, 'C80', VEHICLE, 'session');
    assert.equal(result.ok, true);
    assert.deepEqual(result.body, {
      vehicle_id: 42,
      lat: POINT.latitude,
      lng: POINT.longitude,
    });
    assert.equal('zone_id' in result.body, false);
    assert.equal('zoneCode' in result.body, false);
  });

  it('does not copy zone code onto the body', () => {
    const result = buildAlreadyPaidStart(POINT, 'ZONE-XYZ', VEHICLE, null);
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(result.body).includes('ZONE'), false);
  });

  it('includes accuracy_m only for finite values from 0 through 100', () => {
    const withAccuracy = buildAlreadyPaidStart(
      { ...POINT, accuracyM: 12.5 },
      'C80',
      VEHICLE,
      null,
    );
    assert.equal(withAccuracy.ok, true);
    assert.equal(withAccuracy.body.accuracy_m, 12.5);

    const zero = buildAlreadyPaidStart(
      { ...POINT, accuracyM: 0 },
      'C80',
      VEHICLE,
      null,
    );
    assert.equal(zero.ok, true);
    assert.equal(zero.body.accuracy_m, 0);

    const max = buildAlreadyPaidStart(
      { ...POINT, accuracyM: 100 },
      'C80',
      VEHICLE,
      null,
    );
    assert.equal(max.ok, true);
    assert.equal(max.body.accuracy_m, 100);

    for (const accuracyM of [null, undefined, -1, 101, Number.NaN]) {
      const result = buildAlreadyPaidStart(
        { ...POINT, accuracyM },
        'C80',
        VEHICLE,
        null,
      );
      assert.equal(result.ok, true);
      assert.equal('accuracy_m' in result.body, false);
    }

    const missing = buildAlreadyPaidStart(POINT, 'C80', VEHICLE, null);
    assert.equal(missing.ok, true);
    assert.equal('accuracy_m' in missing.body, false);
  });

  it('sets hours for prepaid from default_park_time when integer 1–24, else 1', () => {
    const fromDefault = buildAlreadyPaidStart(
      POINT,
      'C80',
      { id: 1, default_park_time: 8 },
      'prepaid',
    );
    assert.equal(fromDefault.ok, true);
    assert.equal(fromDefault.body.hours, 8);

    for (const default_park_time of [null, 0, 25, 1.5, Number.NaN]) {
      const result = buildAlreadyPaidStart(
        POINT,
        'C80',
        { id: 1, default_park_time },
        'prepaid',
      );
      assert.equal(result.ok, true);
      assert.equal(result.body.hours, 1);
    }
  });

  it('omits hours for session and null payment models', () => {
    for (const paymentModel of ['session', null]) {
      const result = buildAlreadyPaidStart(
        POINT,
        'C80',
        { id: 1, default_park_time: 4 },
        paymentModel,
      );
      assert.equal(result.ok, true);
      assert.equal('hours' in result.body, false);
    }
  });
});

describe('subscribeReminderLog / emitReminderLog', () => {
  it('delivers emit lines to subscribers', () => {
    const lines: string[] = [];
    const unsubscribe = subscribeReminderLog((line) => lines.push(line));
    emitReminderLog('first');
    emitReminderLog('second');
    unsubscribe();
    assert.deepEqual(lines, ['first', 'second']);
  });

  it('stops delivery after unsubscribe', () => {
    const lines: string[] = [];
    const unsubscribe = subscribeReminderLog((line) => lines.push(line));
    emitReminderLog('before');
    unsubscribe();
    emitReminderLog('after');
    assert.deepEqual(lines, ['before']);
  });

  it('continues notifying later listeners when one throws', () => {
    const received: string[] = [];
    const unsubThrow = subscribeReminderLog(() => {
      throw new Error('listener failed');
    });
    const unsubGood = subscribeReminderLog((line) => received.push(line));
    emitReminderLog('payload');
    unsubThrow();
    unsubGood();
    assert.deepEqual(received, ['payload']);
  });
});
