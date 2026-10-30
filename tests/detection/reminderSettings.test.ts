// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyReminderDelaysUpdate,
  reminderDelaysFromStored,
  remindersEnabledFromStored,
  removeIgnoredSpot,
} from '../../src/detection/reminderSettings.ts';

const DEFAULT_DELAYS = {
  secondReminderMinutes: 5,
  prepaidExpiryLeadMinutes: 10,
  stillParkedAfterHours: 3,
};

describe('remindersEnabledFromStored', () => {
  it('defaults to on when the stored value is missing', () => {
    assert.equal(remindersEnabledFromStored(undefined), true);
    assert.equal(remindersEnabledFromStored(null), true);
  });

  it('defaults to on for non-object or empty payloads', () => {
    assert.equal(remindersEnabledFromStored(true), true);
    assert.equal(remindersEnabledFromStored(false), true);
    assert.equal(remindersEnabledFromStored('false'), true);
    assert.equal(remindersEnabledFromStored({}), true);
    assert.equal(remindersEnabledFromStored({ enabled: true }), true);
    assert.equal(remindersEnabledFromStored({ enabled: 'false' }), true);
  });

  it('is off only when enabled is explicitly false', () => {
    assert.equal(remindersEnabledFromStored({ enabled: false }), false);
  });

  it('is on when enabled is explicitly true', () => {
    assert.equal(remindersEnabledFromStored({ enabled: true }), true);
  });
});

describe('removeIgnoredSpot', () => {
  const spots = [
    { latitude: 41.99, longitude: 21.43, radiusM: 50 },
    { latitude: 42.0, longitude: 21.44, radiusM: 50 },
    { latitude: 42.01, longitude: 21.45, radiusM: 50 },
  ];

  it('removes the spot at a valid index and leaves the others', () => {
    const result = removeIgnoredSpot(spots, 1);
    assert.notEqual(result, spots);
    assert.deepEqual(result, [spots[0], spots[2]]);
    assert.deepEqual(spots, [
      { latitude: 41.99, longitude: 21.43, radiusM: 50 },
      { latitude: 42.0, longitude: 21.44, radiusM: 50 },
      { latitude: 42.01, longitude: 21.45, radiusM: 50 },
    ]);
  });

  it('removes the first and last index', () => {
    assert.deepEqual(removeIgnoredSpot(spots, 0), [spots[1], spots[2]]);
    assert.deepEqual(removeIgnoredSpot(spots, 2), [spots[0], spots[1]]);
  });

  it('returns the same array for an out-of-range or non-integer index', () => {
    for (const index of [-1, 3, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(removeIgnoredSpot(spots, index), spots);
    }
  });

  it('returns the same empty array when removing from an empty list', () => {
    const empty = [];
    assert.equal(removeIgnoredSpot(empty, 0), empty);
  });
});

describe('reminderDelaysFromStored', () => {
  it('defaults to 5 / 10 / 3 when the stored value is missing or not an object', () => {
    assert.deepEqual(reminderDelaysFromStored(undefined), DEFAULT_DELAYS);
    assert.deepEqual(reminderDelaysFromStored(null), DEFAULT_DELAYS);
    assert.deepEqual(reminderDelaysFromStored(true), DEFAULT_DELAYS);
    assert.deepEqual(reminderDelaysFromStored('5'), DEFAULT_DELAYS);
    assert.deepEqual(reminderDelaysFromStored(5), DEFAULT_DELAYS);
  });

  it('keeps valid integers in range', () => {
    assert.deepEqual(
      reminderDelaysFromStored({
        secondReminderMinutes: 1,
        prepaidExpiryLeadMinutes: 180,
        stillParkedAfterHours: 24,
      }),
      {
        secondReminderMinutes: 1,
        prepaidExpiryLeadMinutes: 180,
        stillParkedAfterHours: 24,
      },
    );
    assert.deepEqual(
      reminderDelaysFromStored({
        secondReminderMinutes: 180,
        prepaidExpiryLeadMinutes: 1,
        stillParkedAfterHours: 1,
      }),
      {
        secondReminderMinutes: 180,
        prepaidExpiryLeadMinutes: 1,
        stillParkedAfterHours: 1,
      },
    );
  });

  it('falls back per field for out-of-range, non-integer, or wrong type', () => {
    assert.deepEqual(
      reminderDelaysFromStored({
        secondReminderMinutes: 0,
        prepaidExpiryLeadMinutes: 15,
        stillParkedAfterHours: 6,
      }),
      {
        secondReminderMinutes: 5,
        prepaidExpiryLeadMinutes: 15,
        stillParkedAfterHours: 6,
      },
    );
    assert.deepEqual(
      reminderDelaysFromStored({
        secondReminderMinutes: 30,
        prepaidExpiryLeadMinutes: 181,
        stillParkedAfterHours: 6,
      }),
      {
        secondReminderMinutes: 30,
        prepaidExpiryLeadMinutes: 10,
        stillParkedAfterHours: 6,
      },
    );
    assert.deepEqual(
      reminderDelaysFromStored({
        secondReminderMinutes: 30,
        prepaidExpiryLeadMinutes: 15,
        stillParkedAfterHours: 25,
      }),
      {
        secondReminderMinutes: 30,
        prepaidExpiryLeadMinutes: 15,
        stillParkedAfterHours: 3,
      },
    );
    assert.deepEqual(
      reminderDelaysFromStored({
        secondReminderMinutes: 1.5,
        prepaidExpiryLeadMinutes: 15,
        stillParkedAfterHours: 6,
      }),
      {
        secondReminderMinutes: 5,
        prepaidExpiryLeadMinutes: 15,
        stillParkedAfterHours: 6,
      },
    );
    assert.deepEqual(
      reminderDelaysFromStored({
        secondReminderMinutes: 30,
        prepaidExpiryLeadMinutes: '10',
        stillParkedAfterHours: 6,
      }),
      {
        secondReminderMinutes: 30,
        prepaidExpiryLeadMinutes: 10,
        stillParkedAfterHours: 6,
      },
    );
    assert.deepEqual(
      reminderDelaysFromStored({
        secondReminderMinutes: 30,
        prepaidExpiryLeadMinutes: 15,
        stillParkedAfterHours: null,
      }),
      {
        secondReminderMinutes: 30,
        prepaidExpiryLeadMinutes: 15,
        stillParkedAfterHours: 3,
      },
    );
  });

  it('defaults missing fields on an otherwise empty object', () => {
    assert.deepEqual(reminderDelaysFromStored({}), DEFAULT_DELAYS);
  });
});

describe('applyReminderDelaysUpdate', () => {
  const current = {
    secondReminderMinutes: 20,
    prepaidExpiryLeadMinutes: 12,
    stillParkedAfterHours: 4,
  };

  it('clamps a changed field and keeps omitted fields', () => {
    assert.deepEqual(applyReminderDelaysUpdate(current, { secondReminderMinutes: 45 }), {
      secondReminderMinutes: 45,
      prepaidExpiryLeadMinutes: 12,
      stillParkedAfterHours: 4,
    });
    assert.deepEqual(
      applyReminderDelaysUpdate(current, { prepaidExpiryLeadMinutes: 1 }),
      {
        secondReminderMinutes: 20,
        prepaidExpiryLeadMinutes: 1,
        stillParkedAfterHours: 4,
      },
    );
    assert.deepEqual(
      applyReminderDelaysUpdate(current, { stillParkedAfterHours: 24 }),
      {
        secondReminderMinutes: 20,
        prepaidExpiryLeadMinutes: 12,
        stillParkedAfterHours: 24,
      },
    );
  });

  it('falls back to the field default when the update value is invalid', () => {
    assert.deepEqual(
      applyReminderDelaysUpdate(current, { secondReminderMinutes: 0 }),
      {
        secondReminderMinutes: 5,
        prepaidExpiryLeadMinutes: 12,
        stillParkedAfterHours: 4,
      },
    );
    assert.deepEqual(
      applyReminderDelaysUpdate(current, { prepaidExpiryLeadMinutes: 200 }),
      {
        secondReminderMinutes: 20,
        prepaidExpiryLeadMinutes: 10,
        stillParkedAfterHours: 4,
      },
    );
    assert.deepEqual(
      applyReminderDelaysUpdate(current, { stillParkedAfterHours: 1.5 }),
      {
        secondReminderMinutes: 20,
        prepaidExpiryLeadMinutes: 12,
        stillParkedAfterHours: 3,
      },
    );
    assert.deepEqual(
      applyReminderDelaysUpdate(current, {
        secondReminderMinutes: '9',
        prepaidExpiryLeadMinutes: null,
        stillParkedAfterHours: 99,
      }),
      DEFAULT_DELAYS,
    );
  });

  it('returns current when the update is empty', () => {
    assert.deepEqual(applyReminderDelaysUpdate(current, {}), current);
  });
});
