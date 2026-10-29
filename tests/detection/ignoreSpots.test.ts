// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IGNORE_RADIUS_M,
  addIgnoredSpot,
  distanceMeters,
  isIgnoredFix,
} from '../../src/detection/ignoreSpots.ts';

const BASE = { latitude: 41.99, longitude: 21.43 };

describe('IGNORE_RADIUS_M', () => {
  it('is 50 meters', () => {
    assert.equal(IGNORE_RADIUS_M, 50);
  });
});

describe('distanceMeters', () => {
  it('returns 0 for the same point', () => {
    assert.equal(distanceMeters(BASE, BASE), 0);
  });

  it('returns Infinity when any coordinate is non-finite', () => {
    const badPoints = [
      { latitude: Number.NaN, longitude: 21 },
      { latitude: 41, longitude: Number.POSITIVE_INFINITY },
      { latitude: Number.NEGATIVE_INFINITY, longitude: 21 },
      { latitude: 41, longitude: Number.NaN },
    ];
    for (const bad of badPoints) {
      assert.equal(distanceMeters(BASE, bad), Infinity);
      assert.equal(distanceMeters(bad, BASE), Infinity);
    }
  });

  it('is under 100 m for about 0.0004 degrees latitude offset', () => {
    const nearby = {
      latitude: BASE.latitude + 0.0004,
      longitude: BASE.longitude,
    };
    const d = distanceMeters(BASE, nearby);
    assert.ok(d < 100);
  });

  it('is over 100 m for about 0.002 degrees latitude offset', () => {
    const far = {
      latitude: BASE.latitude + 0.002,
      longitude: BASE.longitude,
    };
    const d = distanceMeters(BASE, far);
    assert.ok(d > 100);
  });
});

describe('isIgnoredFix', () => {
  it('is false for an empty spot list', () => {
    assert.equal(isIgnoredFix([], BASE), false);
  });

  it('is false when the point is missing', () => {
    const spots = [{ ...BASE, radiusM: 100 }];
    for (const point of [null, undefined]) {
      assert.equal(isIgnoredFix(spots, point), false);
    }
  });

  it('is false when latitude or longitude is non-finite', () => {
    const spots = [{ ...BASE, radiusM: 100 }];
    for (const point of [
      { latitude: Number.NaN, longitude: BASE.longitude },
      { latitude: BASE.latitude, longitude: Number.POSITIVE_INFINITY },
    ]) {
      assert.equal(isIgnoredFix(spots, point), false);
    }
  });

  it('is true when the point is within a spot radiusM', () => {
    const spots = [{ ...BASE, radiusM: 100 }];
    const nearby = {
      latitude: BASE.latitude + 0.0004,
      longitude: BASE.longitude,
    };
    assert.equal(isIgnoredFix(spots, nearby), true);
  });

  it('is false when the point is outside a spot radiusM', () => {
    const spots = [{ ...BASE, radiusM: 100 }];
    const far = {
      latitude: BASE.latitude + 0.002,
      longitude: BASE.longitude,
    };
    assert.equal(isIgnoredFix(spots, far), false);
  });

  it('does not treat a spot with non-finite radiusM as covering the point', () => {
    const spots = [{ ...BASE, radiusM: Number.NaN }];
    assert.equal(isIgnoredFix(spots, BASE), false);
    const spotsInf = [{ ...BASE, radiusM: Number.POSITIVE_INFINITY }];
    assert.equal(isIgnoredFix(spotsInf, BASE), false);
  });
});

describe('addIgnoredSpot', () => {
  it('returns the same list for a missing or non-finite point', () => {
    const spots = [{ ...BASE, radiusM: 50 }];
    for (const point of [null, undefined]) {
      assert.equal(addIgnoredSpot(spots, point), spots);
    }
    const bad = { latitude: Number.NaN, longitude: 21 };
    assert.equal(addIgnoredSpot(spots, bad), spots);
  });

  it('returns the same list when the point is already inside a spot', () => {
    const spots = [{ ...BASE, radiusM: 100 }];
    const nearby = {
      latitude: BASE.latitude + 0.0004,
      longitude: BASE.longitude,
    };
    assert.equal(addIgnoredSpot(spots, nearby), spots);
  });

  it('returns a new array with one extra spot at radiusM 50', () => {
    const spots = [];
    const newPoint = { latitude: 42.01, longitude: 21.44 };
    const result = addIgnoredSpot(spots, newPoint);
    assert.notEqual(result, spots);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], {
      latitude: newPoint.latitude,
      longitude: newPoint.longitude,
      radiusM: 50,
    });
  });

  it('does not mutate the input array', () => {
    const spots = [{ latitude: 41.5, longitude: 21.5, radiusM: 100 }];
    const before = spots.slice();
    addIgnoredSpot(spots, { latitude: 42.01, longitude: 21.44 });
    assert.deepEqual(spots, before);
  });
});
