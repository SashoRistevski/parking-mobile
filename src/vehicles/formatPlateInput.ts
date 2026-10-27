/** Display helper for Macedonian plates (letters, digits, letters) while typing. */
export function formatPlateInput(value: string): string {
  const compact = value.replace(/[\s-]/g, '').toUpperCase();
  if (!compact) {
    return '';
  }

  const match = compact.match(/^([A-Z]{1,2})(\d{0,4})?([A-Z]{0,2})?$/);
  if (!match) {
    return compact;
  }

  const letters = match[1] ?? '';
  const digits = match[2] ?? '';
  const letters2 = match[3] ?? '';
  const consumed = letters + digits + letters2;

  if (consumed.length !== compact.length) {
    return compact;
  }

  if (digits.length > 0 && letters.length < 2) {
    return compact;
  }

  if (letters2.length > 0 && digits.length < 4) {
    return compact;
  }

  let formatted = letters;
  if (digits.length > 0) {
    formatted += ` ${digits}`;
  }
  if (letters2.length > 0) {
    formatted += ` ${letters2}`;
  }
  return formatted;
}
