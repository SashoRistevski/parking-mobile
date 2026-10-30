import { File, Paths } from 'expo-file-system';

import { apiRequestMeta } from '../api/client';
import type { Holiday, ZoneFeature, ZoneOperator } from '../detection/zone';

const FEATURES_FILE = 'zones-cache-features.json';
const HOLIDAYS_FILE = 'zones-cache-holidays.json';
const META_FILE = 'zones-cache-meta.json';

const CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000;

type ZonesResponse = {
  features: {
    geometry?: { type: string; coordinates: unknown };
    properties?: {
      code?: string;
      name?: string;
      zone_id?: number;
      today?: ZoneFeature['properties']['today'];
      color?: string;
      operator?: {
        short_name?: string;
        payment_model?: string;
      };
    };
  }[];
};

type HolidaysResponse = {
  data: { date: string }[];
};

type CacheMeta = {
  fetchedAt: number;
  zonesEtag: string | null;
  holidaysEtag: string | null;
};

export type ZoneCacheResult = {
  features: ZoneFeature[];
  holidays: Holiday[];
  fetchedAt: number;
  offline: boolean;
};

function skopjeYearBounds(): { from: string; to: string } {
  const year = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Skopje',
    year: 'numeric',
  }).format(new Date());
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function mapOperator(raw: {
  short_name?: string;
  payment_model?: string;
} | undefined): ZoneOperator | undefined {
  const shortName = raw?.short_name;
  const paymentModel = raw?.payment_model;
  if (!shortName || !paymentModel) {
    return undefined;
  }
  return { short_name: shortName, payment_model: paymentModel };
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
    const properties: ZoneFeature['properties'] = {
      code,
      today: item.properties?.today ?? null,
    };
    const name = item.properties?.name;
    if (name) {
      properties.name = name;
    }
    const zoneId = item.properties?.zone_id;
    if (typeof zoneId === 'number' && Number.isFinite(zoneId)) {
      properties.zone_id = zoneId;
    }
    const color = item.properties?.color;
    if (color) {
      properties.color = color;
    }
    const operator = mapOperator(item.properties?.operator);
    if (operator) {
      properties.operator = operator;
    }
    out.push({
      geometry: geometry as ZoneFeature['geometry'],
      properties,
    });
  }
  return out;
}

function mapHolidays(raw: HolidaysResponse): Holiday[] {
  return (raw.data ?? []).map((row) => ({ date: row.date }));
}

async function writeJsonFile(filename: string, data: unknown): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(JSON.stringify(data));
}

function readJsonFile<T>(filename: string): T | null {
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

function readStoredCache(): {
  meta: CacheMeta | null;
  features: ZoneFeature[];
  holidays: Holiday[];
} {
  const meta = readJsonFile<CacheMeta>(META_FILE);
  const features = readJsonFile<ZoneFeature[]>(FEATURES_FILE) ?? [];
  const holidays = readJsonFile<Holiday[]>(HOLIDAYS_FILE) ?? [];
  return { meta, features, holidays };
}

function ifNoneMatchHeader(etag: string | null): Record<string, string> {
  if (!etag) {
    return {};
  }
  return { 'If-None-Match': etag };
}

async function fetchZonesConditional(etag: string | null) {
  return apiRequestMeta<ZonesResponse>('/zones', {
    auth: false,
    headers: ifNoneMatchHeader(etag),
  });
}

async function fetchHolidaysConditional(etag: string | null) {
  const { from, to } = skopjeYearBounds();
  const path = `/holidays?from=${from}&to=${to}`;
  return apiRequestMeta<HolidaysResponse>(path, {
    auth: false,
    headers: ifNoneMatchHeader(etag),
  });
}

export function findFeatureByCode(
  features: ZoneFeature[],
  code: string | null,
): ZoneFeature | undefined {
  if (!code) {
    return undefined;
  }
  return features.find((f) => f.properties.code === code);
}

export function paidEndsAt(feature: ZoneFeature): string | null {
  return feature.properties.today?.ends_at ?? null;
}

export async function loadZoneCache(): Promise<ZoneCacheResult> {
  const stored = readStoredCache();
  const hasStored = stored.meta !== null;

  const needsRefresh =
    stored.meta === null ||
    Date.now() - stored.meta.fetchedAt > CACHE_MAX_AGE_MS;

  if (!needsRefresh && stored.meta !== null) {
    return {
      features: stored.features,
      holidays: stored.holidays,
      fetchedAt: stored.meta.fetchedAt,
      offline: false,
    };
  }

  let features = stored.features;
  let holidays = stored.holidays;
  let zonesEtag = stored.meta?.zonesEtag ?? null;
  let holidaysEtag = stored.meta?.holidaysEtag ?? null;

  try {
    const zonesResult = await fetchZonesConditional(zonesEtag);
    if (zonesResult.status !== 304 && zonesResult.body !== null) {
      features = mapZoneFeatures(zonesResult.body);
      if (zonesResult.etag) {
        zonesEtag = zonesResult.etag;
      }
    }

    const holidaysResult = await fetchHolidaysConditional(holidaysEtag);
    if (holidaysResult.status !== 304 && holidaysResult.body !== null) {
      holidays = mapHolidays(holidaysResult.body);
      if (holidaysResult.etag) {
        holidaysEtag = holidaysResult.etag;
      }
    }

    const fetchedAt = Date.now();
    const meta: CacheMeta = {
      fetchedAt,
      zonesEtag,
      holidaysEtag,
    };
    await writeJsonFile(FEATURES_FILE, features);
    await writeJsonFile(HOLIDAYS_FILE, holidays);
    await writeJsonFile(META_FILE, meta);

    return { features, holidays, fetchedAt, offline: false };
  } catch {
    if (hasStored && stored.meta !== null) {
      return {
        features: stored.features,
        holidays: stored.holidays,
        fetchedAt: stored.meta.fetchedAt,
        offline: true,
      };
    }
    return {
      features: [],
      holidays: [],
      fetchedAt: 0,
      offline: true,
    };
  }
}
