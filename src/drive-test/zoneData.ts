import { File, Paths } from 'expo-file-system';

import { apiRequest } from '../api/client';
import type { Holiday, ZoneFeature } from '../detection/zone';

const ZONES_CACHE = 'drive-test-zones.json';
const HOLIDAYS_CACHE = 'drive-test-holidays.json';

type ZonesResponse = {
  features: {
    geometry?: { type: string; coordinates: unknown };
    properties?: {
      code?: string;
      today?: ZoneFeature['properties']['today'];
    };
  }[];
};

type HolidaysResponse = {
  data: { date: string }[];
};

type ActiveSessionsResponse = {
  data: unknown[];
};

function skopjeYearBounds(): { from: string; to: string } {
  const year = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Skopje',
    year: 'numeric',
  }).format(new Date());
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function mapZoneFeatures(raw: ZonesResponse): ZoneFeature[] {
  const out: ZoneFeature[] = [];
  for (const item of raw.features ?? []) {
    const geometry = item.geometry;
    const code = item.properties?.code;
    if (!geometry || !code) {
      continue;
    }
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      continue;
    }
    out.push({
      geometry: geometry as ZoneFeature['geometry'],
      properties: {
        code,
        today: item.properties?.today ?? null,
      },
    });
  }
  return out;
}

function mapHolidays(raw: HolidaysResponse): Holiday[] {
  return (raw.data ?? []).map((row) => ({ date: row.date }));
}

async function writeJsonCache(filename: string, data: unknown): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(JSON.stringify(data));
}

function readJsonCache<T>(filename: string): T | null {
  const file = new File(Paths.cache, filename);
  if (!file.exists) {
    return null;
  }
  try {
    return JSON.parse(file.textSync()) as T;
  } catch {
    return null;
  }
}

export async function loadZones(): Promise<ZoneFeature[]> {
  try {
    const raw = await apiRequest<ZonesResponse>('/zones', { auth: false });
    const features = mapZoneFeatures(raw);
    await writeJsonCache(ZONES_CACHE, features);
    return features;
  } catch {
    const cached = readJsonCache<ZoneFeature[]>(ZONES_CACHE);
    return cached ?? [];
  }
}

export async function loadHolidays(): Promise<Holiday[]> {
  const { from, to } = skopjeYearBounds();
  const path = `/holidays?from=${from}&to=${to}`;
  try {
    const raw = await apiRequest<HolidaysResponse>(path, { auth: false });
    const holidays = mapHolidays(raw);
    await writeJsonCache(HOLIDAYS_CACHE, holidays);
    return holidays;
  } catch {
    try {
      const raw = await apiRequest<HolidaysResponse>(path, { auth: true });
      const holidays = mapHolidays(raw);
      await writeJsonCache(HOLIDAYS_CACHE, holidays);
      return holidays;
    } catch {
      const cached = readJsonCache<Holiday[]>(HOLIDAYS_CACHE);
      return cached ?? [];
    }
  }
}

export async function fetchOpenSession(): Promise<boolean> {
  try {
    const raw = await apiRequest<ActiveSessionsResponse>('/sessions/active', {
      auth: true,
    });
    return Array.isArray(raw.data) && raw.data.length > 0;
  } catch {
    return false;
  }
}
