import { File, Paths } from 'expo-file-system';

import type { Locale } from './catalogs';
import { localeFromStored } from './localeParse';

const LOCALE_FILE = 'locale.json';

function readStoredLocale(): unknown {
  const file = new File(Paths.document, LOCALE_FILE);
  if (!file.exists) {
    return undefined;
  }
  try {
    return JSON.parse(file.textSync()) as unknown;
  } catch {
    return undefined;
  }
}

export function readLocaleOverride(): Locale | null {
  return localeFromStored(readStoredLocale());
}

export async function writeLocale(locale: Locale): Promise<void> {
  const file = new File(Paths.document, LOCALE_FILE);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(JSON.stringify({ locale }));
}
