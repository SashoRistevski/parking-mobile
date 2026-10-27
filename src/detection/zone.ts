export type ZoneTodayWindow = {
  starts_at: string;
  ends_at: string;
};

export type ZoneOperator = {
  short_name: string;
  payment_model: string;
};

export type ZoneFeatureProperties = {
  code: string;
  today: ZoneTodayWindow | null;
  name?: string;
  color?: string;
  operator?: ZoneOperator;
  zone_id?: number;
};

export type ZonePolygonGeometry = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type ZoneMultiPolygonGeometry = {
  type: 'MultiPolygon';
  coordinates: number[][][][];
};

export type ZoneFeature = {
  geometry: ZonePolygonGeometry | ZoneMultiPolygonGeometry;
  properties: ZoneFeatureProperties;
};

export type Holiday = { date: string };

type Position = [number, number];
type Ring = Position[];
type PolygonRings = Ring[];

const METERS_PER_DEGREE_LAT = 111_320;
const EPS = 1e-10;

function normalizeTime(value: string): string {
  const parts = value.split(':');
  const hours = (parts[0] ?? '0').padStart(2, '0');
  const minutes = (parts[1] ?? '0').padStart(2, '0');
  const seconds = (parts[2] ?? '0').padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function skopjeCalendarParts(atMs: number): {
  date: string;
  isSunday: boolean;
  time: string;
} {
  const instant = new Date(atMs);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Skopje',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Skopje',
    weekday: 'short',
  }).format(instant);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Skopje',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);

  const hour = timeParts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = timeParts.find((p) => p.type === 'minute')?.value ?? '00';
  const second = timeParts.find((p) => p.type === 'second')?.value ?? '00';
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;

  return { date, isSunday: weekday === 'Sun', time };
}

function isWithinTime(current: string, startsAt: string, endsAt: string): boolean {
  const now = normalizeTime(current);
  const start = normalizeTime(startsAt);
  const end = normalizeTime(endsAt);
  return now >= start && now < end;
}

function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  const cross = (py - y1) * (x2 - x1) - (px - x1) * (y2 - y1);
  if (Math.abs(cross) > EPS) {
    return false;
  }
  const dot = (px - x1) * (x2 - x1) + (py - y1) * (y2 - y1);
  if (dot < -EPS) {
    return false;
  }
  const lenSq = distanceSquared(x1, y1, x2, y2);
  if (dot - lenSq > EPS) {
    return false;
  }
  return true;
}

function pointOnRing(lng: number, lat: number, ring: Ring): boolean {
  const count = ring.length;
  if (count < 2) {
    return false;
  }
  const limit = ring[0][0] === ring[count - 1][0] && ring[0][1] === ring[count - 1][1]
    ? count - 1
    : count;
  for (let i = 0; i < limit; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % count];
    if (pointOnSegment(lng, lat, x1, y1, x2, y2)) {
      return true;
    }
  }
  return false;
}

function pointInRingInterior(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  const count = ring.length;
  if (count < 3) {
    return false;
  }
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  return pointOnRing(lng, lat, ring) || pointInRingInterior(lng, lat, ring);
}

function pointInPolygonRings(lng: number, lat: number, rings: PolygonRings): boolean {
  if (rings.length === 0) {
    return false;
  }
  const outer = rings[0];
  if (!pointInRing(lng, lat, outer)) {
    return false;
  }
  for (let h = 1; h < rings.length; h++) {
    const hole = rings[h];
    if (pointInRingInterior(lng, lat, hole) && !pointOnRing(lng, lat, hole)) {
      return false;
    }
  }
  return true;
}

function outerRingArea(ring: Ring): number {
  const count = ring.length;
  if (count < 3) {
    return 0;
  }
  let area = 0;
  const limit = ring[0][0] === ring[count - 1][0] && ring[0][1] === ring[count - 1][1]
    ? count - 1
    : count;
  for (let i = 0; i < limit; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % count];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

function polygonsFromGeometry(
  geometry: ZoneFeature['geometry'],
): PolygonRings[] {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates as PolygonRings];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates as PolygonRings[];
  }
  return [];
}

function winningZoneCode(
  features: ZoneFeature[],
  latitude: number,
  longitude: number,
): string | null {
  let bestCode: string | null = null;
  let bestArea = Infinity;

  for (const feature of features) {
    const polygons = polygonsFromGeometry(feature.geometry);
    for (const rings of polygons) {
      if (!pointInPolygonRings(longitude, latitude, rings)) {
        continue;
      }
      const area = outerRingArea(rings[0]);
      if (area < bestArea) {
        bestArea = area;
        bestCode = feature.properties.code;
      }
    }
  }

  return bestCode;
}

export function zoneAt(
  features: ZoneFeature[],
  latitude: number,
  longitude: number,
  accuracyM: number | null,
): { zoneCode: string | null; ambiguous: boolean } {
  const zoneCode = winningZoneCode(features, latitude, longitude);
  const radius = accuracyM === null || accuracyM < 0 ? 0 : accuracyM;

  if (radius === 0) {
    return { zoneCode, ambiguous: false };
  }

  const latRad = (latitude * Math.PI) / 180;
  const mPerDegLng = METERS_PER_DEGREE_LAT * Math.max(Math.cos(latRad), 1e-10);

  let ambiguous = false;
  for (let k = 0; k < 8; k++) {
    const theta = (2 * Math.PI * k) / 8;
    const eastM = radius * Math.cos(theta);
    const northM = radius * Math.sin(theta);
    const sampleLat = latitude + northM / METERS_PER_DEGREE_LAT;
    const sampleLng = longitude + eastM / mPerDegLng;
    const sampleCode = winningZoneCode(features, sampleLat, sampleLng);
    if (sampleCode !== zoneCode) {
      ambiguous = true;
      break;
    }
  }

  return { zoneCode, ambiguous };
}

export function paidNow(feature: ZoneFeature, atMs: number, holidays: Holiday[]): boolean {
  const code = feature.properties.code;
  const { date, isSunday, time } = skopjeCalendarParts(atMs);
  const isHoliday = holidays.some((holiday) => holiday.date === date);

  if (isSunday && code !== 'A0') {
    return false;
  }
  if (isHoliday && code !== 'A0') {
    return false;
  }
  if (code === 'A0' && (isSunday || isHoliday)) {
    return isWithinTime(time, '09:00:00', '16:00:00');
  }

  const today = feature.properties.today;
  if (today === null) {
    return false;
  }

  return isWithinTime(time, today.starts_at, today.ends_at);
}
