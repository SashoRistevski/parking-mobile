export const IGNORE_RADIUS_M = 50;

export type IgnoredSpot = {
  latitude: number;
  longitude: number;
  radiusM: number;
};

export type LatLngPoint = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a: LatLngPoint, b: LatLngPoint): number {
  if (
    !Number.isFinite(a.latitude) ||
    !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) ||
    !Number.isFinite(b.longitude)
  ) {
    return Infinity;
  }

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLon = Math.sin(dLon / 2);
  const h =
    sinHalfDLat * sinHalfDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDLon * sinHalfDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_M * c;
}

export function isIgnoredFix(
  spots: IgnoredSpot[],
  point: LatLngPoint | null | undefined,
): boolean {
  if (
    !point ||
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude)
  ) {
    return false;
  }

  for (const spot of spots) {
    if (!Number.isFinite(spot.radiusM)) {
      continue;
    }
    if (distanceMeters(point, spot) <= spot.radiusM) {
      return true;
    }
  }

  return false;
}

export function addIgnoredSpot(
  spots: IgnoredSpot[],
  point: LatLngPoint | null | undefined,
): IgnoredSpot[] {
  if (
    !point ||
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude)
  ) {
    return spots;
  }

  if (isIgnoredFix(spots, point)) {
    return spots;
  }

  return [
    ...spots,
    {
      latitude: point.latitude,
      longitude: point.longitude,
      radiusM: IGNORE_RADIUS_M,
    },
  ];
}
