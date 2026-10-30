// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type DetectionConfig,
  type DetectionEvent,
  type DetectionSample,
  initialDetection,
  stepDetection,
} from '../../src/detection/machine.ts';

const testConfig: DetectionConfig = {
  driveSpeedKmh: 20,
  driveFixes: 3,
  minDriveMs: 1000,
  stopSpeedKmh: 5,
  stopMs: 5000,
  walkSteps: 8,
};

function makeSample(
  at: number,
  overrides: Partial<DetectionSample> = {},
): DetectionSample {
  return {
    at,
    speedKmh: null,
    accuracyM: 10,
    stepCount: 0,
    activity: null,
    activityConfidence: null,
    zoneCode: null,
    ambiguous: false,
    paidNow: false,
    openSession: false,
    ignored: false,
    remindedRecently: false,
    ...overrides,
  };
}

function driveToDriving(): ReturnType<typeof initialDetection> {
  let snap = initialDetection();
  const fast = (at: number) =>
    makeSample(at, { speedKmh: 30 });
  for (const at of [0, 400, 1200]) {
    ({ snapshot: snap } = stepDetection(snap, fast(at), testConfig));
  }
  return snap;
}

describe('stepDetection', () => {
  it('1: three fast samples spanning minDriveMs ends in DRIVING with no remind', () => {
    let snap = initialDetection();
    const samples = [
      makeSample(0, { speedKmh: 30 }),
      makeSample(400, { speedKmh: 30 }),
      makeSample(1200, { speedKmh: 30 }),
    ];
    let lastEvent: DetectionEvent = { type: 'none' };
    for (const s of samples) {
      const result = stepDetection(snap, s, testConfig);
      snap = result.snapshot;
      lastEvent = result.event;
    }
    assert.equal(snap.state, 'DRIVING');
    assert.equal(lastEvent.type, 'none');
  });

  it('2: after driving, one slow sample enters STOPPED_CANDIDATE', () => {
    const driving = driveToDriving();
    assert.equal(driving.state, 'DRIVING');
    const { snapshot, event } = stepDetection(
      driving,
      makeSample(2000, { speedKmh: 2, stepCount: 5, zoneCode: 'C80' }),
      testConfig,
    );
    assert.equal(snapshot.state, 'STOPPED_CANDIDATE');
    assert.equal(event.type, 'none');
  });

  it('3: enough steps in paid zone reminds with zone code', () => {
    const driving = driveToDriving();
    const { snapshot: stopped } = stepDetection(
      driving,
      makeSample(2000, { speedKmh: 2, stepCount: 10, zoneCode: 'C80' }),
      testConfig,
    );
    const { snapshot, event } = stepDetection(
      stopped,
      makeSample(2500, {
        speedKmh: 2,
        stepCount: 18,
        zoneCode: 'C80',
        paidNow: true,
        openSession: false,
      }),
      testConfig,
    );
    assert.equal(snapshot.state, 'REMINDED');
    assert.deepEqual(event, { type: 'remind', zoneCode: 'C80' });
  });

  it('4: slow then fast driving before walk threshold returns to DRIVING without remind', () => {
    const driving = driveToDriving();
    const { snapshot: stopped } = stepDetection(
      driving,
      makeSample(2000, { speedKmh: 2, stepCount: 0 }),
      testConfig,
    );
    const { snapshot: stillStopped } = stepDetection(
      stopped,
      makeSample(2500, { speedKmh: 2, stepCount: 3 }),
      testConfig,
    );
    assert.equal(stillStopped.state, 'STOPPED_CANDIDATE');

    let snap = stillStopped;
    let lastEvent: DetectionEvent = { type: 'none' };
    for (const at of [3000, 3400, 4500]) {
      const result = stepDetection(
        snap,
        makeSample(at, { speedKmh: 30, stepCount: 3 }),
        testConfig,
      );
      snap = result.snapshot;
      lastEvent = result.event;
    }
    assert.equal(snap.state, 'DRIVING');
    assert.equal(lastEvent.type, 'none');
  });

  it('5: steps with no zone and not ambiguous do not remind', () => {
    const driving = driveToDriving();
    const { snapshot: stopped } = stepDetection(
      driving,
      makeSample(2000, { speedKmh: 2, stepCount: 0 }),
      testConfig,
    );
    const { snapshot, event } = stepDetection(
      stopped,
      makeSample(2500, {
        speedKmh: 2,
        stepCount: 20,
        zoneCode: null,
        ambiguous: false,
      }),
      testConfig,
    );
    assert.equal(snapshot.state, 'STOPPED_CANDIDATE');
    assert.equal(event.type, 'none');
  });

  it('6: steps in zone with paidNow false do not remind', () => {
    const driving = driveToDriving();
    const { snapshot: stopped } = stepDetection(
      driving,
      makeSample(2000, { speedKmh: 2, stepCount: 0, zoneCode: 'C80' }),
      testConfig,
    );
    const { snapshot, event } = stepDetection(
      stopped,
      makeSample(2500, {
        speedKmh: 2,
        stepCount: 20,
        zoneCode: 'C80',
        paidNow: false,
      }),
      testConfig,
    );
    assert.equal(snapshot.state, 'STOPPED_CANDIDATE');
    assert.equal(event.type, 'none');
  });

  it('7: openSession true goes to PAID without remind', () => {
    const driving = driveToDriving();
    const { snapshot: stopped } = stepDetection(
      driving,
      makeSample(2000, { speedKmh: 2, stepCount: 0, zoneCode: 'C80' }),
      testConfig,
    );
    const { snapshot, event } = stepDetection(
      stopped,
      makeSample(2500, {
        speedKmh: 2,
        stepCount: 20,
        zoneCode: 'C80',
        paidNow: true,
        openSession: true,
      }),
      testConfig,
    );
    assert.equal(snapshot.state, 'PAID');
    assert.equal(event.type, 'none');
  });

  it('8: zone on candidate then null zone not ambiguous goes LEFT', () => {
    const driving = driveToDriving();
    const { snapshot: stopped } = stepDetection(
      driving,
      makeSample(2000, { speedKmh: 2, stepCount: 0, zoneCode: 'C80' }),
      testConfig,
    );
    const { snapshot, event } = stepDetection(
      stopped,
      makeSample(2500, {
        speedKmh: 2,
        stepCount: 2,
        zoneCode: null,
        ambiguous: false,
      }),
      testConfig,
    );
    assert.equal(snapshot.state, 'LEFT');
    assert.equal(event.type, 'none');
  });

  it('9: automotive medium confidence from idle goes to DRIVING', () => {
    const { snapshot, event } = stepDetection(
      initialDetection(),
      makeSample(0, {
        speedKmh: 0,
        activity: 'automotive',
        activityConfidence: 'medium',
      }),
      testConfig,
    );
    assert.equal(snapshot.state, 'DRIVING');
    assert.equal(event.type, 'none');
  });

  it('10: ambiguous with null zone reminds with ? after walk', () => {
    const driving = driveToDriving();
    const { snapshot: stopped } = stepDetection(
      driving,
      makeSample(2000, { speedKmh: 2, stepCount: 0 }),
      testConfig,
    );
    const { snapshot, event } = stepDetection(
      stopped,
      makeSample(2500, {
        speedKmh: 2,
        stepCount: 10,
        zoneCode: null,
        ambiguous: true,
        paidNow: true,
      }),
      testConfig,
    );
    assert.equal(snapshot.state, 'REMINDED');
    assert.deepEqual(event, { type: 'remind', zoneCode: '?' });
  });

  it('11: ignored true does not remind', () => {
    const driving = driveToDriving();
    const { snapshot: stopped } = stepDetection(
      driving,
      makeSample(2000, { speedKmh: 2, stepCount: 0, zoneCode: 'C80' }),
      testConfig,
    );
    const { snapshot, event } = stepDetection(
      stopped,
      makeSample(2500, {
        speedKmh: 2,
        stepCount: 20,
        zoneCode: 'C80',
        paidNow: true,
        ignored: true,
      }),
      testConfig,
    );
    assert.equal(snapshot.state, 'STOPPED_CANDIDATE');
    assert.equal(event.type, 'none');
  });

  it('12: stopped long enough in paid zone without steps still reminds', () => {
    const driving = driveToDriving();
    const { snapshot: stopped } = stepDetection(
      driving,
      makeSample(10_000, { speedKmh: 2, stepCount: 0, zoneCode: 'C80' }),
      testConfig,
    );
    assert.equal(stopped.state, 'STOPPED_CANDIDATE');
    const { snapshot, event } = stepDetection(
      stopped,
      makeSample(15_500, {
        speedKmh: 2,
        stepCount: 0,
        activity: 'stationary',
        zoneCode: 'C80',
        paidNow: true,
      }),
      testConfig,
    );
    assert.equal(snapshot.state, 'REMINDED');
    assert.deepEqual(event, { type: 'remind', zoneCode: 'C80' });
  });
});
