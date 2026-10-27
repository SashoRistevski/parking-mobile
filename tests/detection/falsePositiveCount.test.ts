// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextFalsePositiveCount } from '../../src/detection/falsePositiveCount.ts';

describe('nextFalsePositiveCount', () => {
  it('increments finite non-negative integers', () => {
    assert.equal(nextFalsePositiveCount(0), 1);
    assert.equal(nextFalsePositiveCount(4), 5);
  });

  it('returns 1 for invalid or non-integer numbers', () => {
    assert.equal(nextFalsePositiveCount(-1), 1);
    assert.equal(nextFalsePositiveCount(1.5), 1);
    assert.equal(nextFalsePositiveCount(Number.NaN), 1);
  });

  it('returns 1 for null and non-number values', () => {
    assert.equal(nextFalsePositiveCount(null), 1);
    assert.equal(nextFalsePositiveCount('2'), 1);
  });
});
