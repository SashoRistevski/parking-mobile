import { File, Paths } from 'expo-file-system';

import {
  addIgnoredSpot,
  type IgnoredSpot,
  type LatLngPoint,
} from './ignoreSpots';
import { removeIgnoredSpot } from './reminderSettings';

const SPOTS_FILE = 'ignored-spots.json';

function parseSpot(entry: unknown): IgnoredSpot | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const { latitude, longitude, radiusM } = record;
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    typeof radiusM !== 'number' ||
    !Number.isFinite(radiusM)
  ) {
    return null;
  }
  return { latitude, longitude, radiusM };
}

export function readIgnoredSpots(): IgnoredSpot[] {
  const file = new File(Paths.document, SPOTS_FILE);
  if (!file.exists) {
    return [];
  }
  try {
    const parsed = JSON.parse(file.textSync()) as { spots?: unknown };
    if (!Array.isArray(parsed.spots)) {
      return [];
    }
    const spots: IgnoredSpot[] = [];
    for (const entry of parsed.spots) {
      const spot = parseSpot(entry);
      if (spot) {
        spots.push(spot);
      }
    }
    return spots;
  } catch {
    return [];
  }
}

async function writeSpots(spots: IgnoredSpot[]): Promise<void> {
  const file = new File(Paths.document, SPOTS_FILE);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(JSON.stringify({ spots }));
}

export async function saveIgnoredSpot(
  point: LatLngPoint,
): Promise<{ added: boolean; count: number }> {
  const existing = readIgnoredSpots();
  const next = addIgnoredSpot(existing, point);
  const added = next.length !== existing.length;
  if (added) {
    await writeSpots(next);
  }
  return { added, count: next.length };
}

export async function removeIgnoredSpotAtIndex(index: number): Promise<void> {
  const existing = readIgnoredSpots();
  const next = removeIgnoredSpot(existing, index);
  if (next.length === existing.length) {
    return;
  }
  await writeSpots(next);
}
