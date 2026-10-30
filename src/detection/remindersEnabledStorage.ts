import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';

import { GRADSKI_CLOCK_END_ID } from './gradskiClockEnd';
import { PREPAID_EXPIRY_ID } from './prepaidExpiry';
import { remindersEnabledFromStored } from './reminderSettings';
import { STILL_PARKED_ID } from './stillParked';

const ENABLED_FILE = 'reminders-enabled.json';

function readStoredEnabled(): unknown {
  const file = new File(Paths.document, ENABLED_FILE);
  if (!file.exists) {
    return undefined;
  }
  try {
    return JSON.parse(file.textSync()) as unknown;
  } catch {
    return undefined;
  }
}

export function readRemindersEnabled(): boolean {
  return remindersEnabledFromStored(readStoredEnabled());
}

export async function writeRemindersEnabled(enabled: boolean): Promise<void> {
  const file = new File(Paths.document, ENABLED_FILE);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(JSON.stringify({ enabled }));
}

export async function cancelAllScheduledReminders(): Promise<void> {
  const ids = [PREPAID_EXPIRY_ID, GRADSKI_CLOCK_END_ID, STILL_PARKED_ID];
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
  }
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
}
