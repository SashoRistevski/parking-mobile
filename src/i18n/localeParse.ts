import type { Locale } from './catalogs';

export function localeFromStored(value: unknown): Locale | null {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ((value as { locale?: unknown }).locale === 'mk' ||
      (value as { locale?: unknown }).locale === 'en')
  ) {
    return (value as { locale: Locale }).locale;
  }
  return null;
}
