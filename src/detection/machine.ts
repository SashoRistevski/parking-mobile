export type DetectionState =
  | 'IDLE'
  | 'DRIVING'
  | 'STOPPED_CANDIDATE'
  | 'PARKED_UNPAID'
  | 'REMINDED'
  | 'PAID'
  | 'DISMISSED'
  | 'LEFT';

export type MotionActivity =
  | 'automotive'
  | 'walking'
  | 'stationary'
  | 'cycling'
  | 'running'
  | 'unknown';

export type DetectionSample = {
  at: number;
  speedKmh: number | null;
  accuracyM: number | null;
  stepCount: number | null;
  activity: MotionActivity | null;
  activityConfidence: 'low' | 'medium' | 'high' | null;
  zoneCode: string | null;
  ambiguous: boolean;
  paidNow: boolean;
  openSession: boolean;
  ignored: boolean;
  remindedRecently: boolean;
};

export type DetectionSnapshot = {
  state: DetectionState;
  drivingSince: number | null;
  fastFixes: number;
  stoppedSince: number | null;
  stepsAtStop: number | null;
  zoneCode: string | null;
  remindedAt: number | null;
};

export type DetectionEvent = { type: 'none' } | { type: 'remind'; zoneCode: string };

export type DetectionConfig = {
  driveSpeedKmh: number;
  driveFixes: number;
  minDriveMs: number;
  stopSpeedKmh: number;
  stopMs: number;
  walkSteps: number;
};

export const detectionDefaults: DetectionConfig = {
  driveSpeedKmh: 20,
  driveFixes: 3,
  minDriveMs: 10_000,
  stopSpeedKmh: 5,
  stopMs: 120_000,
  walkSteps: 8,
};

const DRIVING_CANCEL_STATES: DetectionState[] = [
  'IDLE',
  'STOPPED_CANDIDATE',
  'PARKED_UNPAID',
  'REMINDED',
  'PAID',
  'DISMISSED',
  'LEFT',
];

function isAutomotiveDriving(sample: DetectionSample): boolean {
  return (
    sample.activity === 'automotive' &&
    (sample.activityConfidence === 'medium' || sample.activityConfidence === 'high')
  );
}

function isFastSample(sample: DetectionSample, config: DetectionConfig): boolean {
  return sample.speedKmh !== null && sample.speedKmh >= config.driveSpeedKmh;
}

function updateDrivingCounters(
  snapshot: DetectionSnapshot,
  sample: DetectionSample,
  config: DetectionConfig,
): Pick<DetectionSnapshot, 'fastFixes' | 'drivingSince'> {
  if (isFastSample(sample, config)) {
    return {
      fastFixes: snapshot.fastFixes + 1,
      drivingSince: snapshot.drivingSince ?? sample.at,
    };
  }
  if (!isAutomotiveDriving(sample)) {
    return { fastFixes: 0, drivingSince: null };
  }
  return { fastFixes: snapshot.fastFixes, drivingSince: snapshot.drivingSince };
}

function isDrivingEstablished(
  sample: DetectionSample,
  fastFixes: number,
  drivingSince: number | null,
  config: DetectionConfig,
): boolean {
  if (isAutomotiveDriving(sample)) {
    return true;
  }
  return (
    fastFixes >= config.driveFixes &&
    drivingSince !== null &&
    sample.at - drivingSince >= config.minDriveMs
  );
}

function isStoppedSample(sample: DetectionSample, config: DetectionConfig): boolean {
  return sample.speedKmh !== null && sample.speedKmh < config.stopSpeedKmh;
}

function isWalkingMediumOrHigh(sample: DetectionSample): boolean {
  return (
    sample.activity === 'walking' &&
    (sample.activityConfidence === 'medium' || sample.activityConfidence === 'high')
  );
}

function stopArrived(
  snapshot: DetectionSnapshot,
  sample: DetectionSample,
  config: DetectionConfig,
): boolean {
  if (
    snapshot.stepsAtStop !== null &&
    sample.stepCount !== null &&
    sample.stepCount - snapshot.stepsAtStop >= config.walkSteps
  ) {
    return true;
  }
  if (isWalkingMediumOrHigh(sample)) {
    return true;
  }
  if (
    snapshot.stoppedSince !== null &&
    sample.at - snapshot.stoppedSince >= config.stopMs &&
    (isStoppedSample(sample, config) || sample.activity === 'stationary')
  ) {
    return true;
  }
  return false;
}

function inZoneOrAmbiguous(sample: DetectionSample): boolean {
  return sample.zoneCode !== null || sample.ambiguous;
}

export function initialDetection(): DetectionSnapshot {
  return {
    state: 'IDLE',
    drivingSince: null,
    fastFixes: 0,
    stoppedSince: null,
    stepsAtStop: null,
    zoneCode: null,
    remindedAt: null,
  };
}

export function stepDetection(
  snapshot: DetectionSnapshot,
  sample: DetectionSample,
  config: DetectionConfig = detectionDefaults,
): { snapshot: DetectionSnapshot; event: DetectionEvent } {
  const counters = updateDrivingCounters(snapshot, sample, config);
  const drivingEstablished = isDrivingEstablished(
    sample,
    counters.fastFixes,
    counters.drivingSince,
    config,
  );

  let next: DetectionSnapshot = { ...snapshot, ...counters };
  const event: DetectionEvent = { type: 'none' };

  if (drivingEstablished && DRIVING_CANCEL_STATES.includes(next.state)) {
    return {
      snapshot: {
        ...next,
        state: 'DRIVING',
        stoppedSince: null,
        stepsAtStop: null,
        zoneCode: null,
      },
      event,
    };
  }

  if (next.state === 'DRIVING' && !drivingEstablished) {
    const stopped = isStoppedSample(sample, config);
    const stationaryOrWalking =
      sample.activity === 'stationary' || sample.activity === 'walking';
    if (stopped || stationaryOrWalking) {
      return {
        snapshot: {
          ...next,
          state: 'STOPPED_CANDIDATE',
          stoppedSince: sample.at,
          stepsAtStop: sample.stepCount,
          zoneCode: sample.zoneCode,
        },
        event,
      };
    }
  }

  if (next.state === 'STOPPED_CANDIDATE') {
    if (sample.openSession) {
      return {
        snapshot: { ...next, state: 'PAID' },
        event,
      };
    }

    if (next.zoneCode !== null && sample.zoneCode === null && !sample.ambiguous) {
      return {
        snapshot: { ...next, state: 'LEFT' },
        event,
      };
    }

    if (stopArrived(next, sample, config)) {
      if (inZoneOrAmbiguous(sample)) {
        if (
          sample.paidNow &&
          !sample.ignored &&
          !sample.remindedRecently
        ) {
          const remindZoneCode = sample.zoneCode ?? '?';
          return {
            snapshot: {
              ...next,
              state: 'REMINDED',
              remindedAt: sample.at,
              zoneCode: remindZoneCode,
            },
            event: { type: 'remind', zoneCode: remindZoneCode },
          };
        }
        if (!sample.paidNow) {
          return { snapshot: next, event };
        }
      }
    }

    return { snapshot: next, event };
  }

  return { snapshot: next, event };
}
