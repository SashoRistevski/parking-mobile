export function nextFalsePositiveCount(current: unknown): number {
  if (
    typeof current === 'number' &&
    Number.isFinite(current) &&
    Number.isInteger(current) &&
    current >= 0
  ) {
    return current + 1;
  }
  return 1;
}
