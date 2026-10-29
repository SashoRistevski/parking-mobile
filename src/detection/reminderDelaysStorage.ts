import { File, Paths } from 'expo-file-system';

import {
  applyReminderDelaysUpdate,
  reminderDelaysFromStored,
  type ReminderDelays,
  type ReminderDelaysUpdate,
} from './reminderSettings';

const DELAYS_FILE = 'reminder-delays.json';

function readStoredDelays(): unknown {
  const file = new File(Paths.document, DELAYS_FILE);
  if (!file.exists) {
    return undefined;
  }
  try {
    return JSON.parse(file.textSync()) as unknown;
  } catch {
    return undefined;
  }
}

export function readReminderDelays(): ReminderDelays {
  return reminderDelaysFromStored(readStoredDelays());
}

export async function writeReminderDelays(
  update: ReminderDelaysUpdate,
): Promise<ReminderDelays> {
  const next = applyReminderDelaysUpdate(readReminderDelays(), update);
  const file = new File(Paths.document, DELAYS_FILE);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(
    JSON.stringify({
      secondReminderMinutes: next.secondReminderMinutes,
      prepaidExpiryLeadMinutes: next.prepaidExpiryLeadMinutes,
      stillParkedAfterHours: next.stillParkedAfterHours,
    }),
  );
  return next;
}
