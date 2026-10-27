import { File, Paths } from 'expo-file-system';

import { nextFalsePositiveCount } from './falsePositiveCount';

export { nextFalsePositiveCount } from './falsePositiveCount';

const COUNT_FILE = 'not-parking-count.json';

function readStoredCount(): unknown {
  const file = new File(Paths.document, COUNT_FILE);
  if (!file.exists) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(file.textSync()) as { count?: unknown };
    return parsed.count;
  } catch {
    return undefined;
  }
}

async function writeCount(count: number): Promise<void> {
  const file = new File(Paths.document, COUNT_FILE);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(JSON.stringify({ count }));
}

export async function recordFalsePositive(): Promise<number> {
  const next = nextFalsePositiveCount(readStoredCount());
  await writeCount(next);
  return next;
}
