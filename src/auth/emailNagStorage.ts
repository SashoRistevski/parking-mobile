import { File, Paths } from 'expo-file-system';

const NAG_FILE = 'email-nag.json';

export function readEmailNagDate(): string | null {
  const file = new File(Paths.document, NAG_FILE);
  if (!file.exists) {
    return null;
  }
  try {
    const parsed = JSON.parse(file.textSync()) as { date?: unknown };
    return typeof parsed.date === 'string' ? parsed.date : null;
  } catch {
    return null;
  }
}

export async function writeEmailNagDate(date: string): Promise<void> {
  const file = new File(Paths.document, NAG_FILE);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(JSON.stringify({ date }));
}

export function skopjeTodayDate(nowMs: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Skopje',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(nowMs));
}
