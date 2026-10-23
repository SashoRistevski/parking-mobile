import { getLocales } from 'expo-localization';

import type { Locale } from './catalogs';

export function resolveInitialLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'mk';
}
