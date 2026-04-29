/** Best-effort ISO 3166-1 alpha-2 from Shopify mailing `country` strings. */
export function toIso3166Alpha2CountryCode(
  raw: string | null | undefined,
  fallback = 'CA',
): string {
  const t = (raw ?? '').trim();
  if (!t) return fallback;
  if (t.length === 2 && /^[a-zA-Z]{2}$/.test(t)) return t.toUpperCase();
  const lower = t.toLowerCase();
  if (lower === 'canada') return 'CA';
  if (
    lower === 'united states' ||
    lower === 'usa' ||
    lower === 'united states of america'
  ) {
    return 'US';
  }
  return fallback;
}
