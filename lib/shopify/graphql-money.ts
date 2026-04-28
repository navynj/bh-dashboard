/**
 * Shopify Admin GraphQL often returns `Money` as `{ amount, currencyCode }`.
 * Older responses (or other callers) may still surface a decimal string.
 */
export function shopifyMoneyAmountToDecimalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    return s === '' ? null : s;
  }
  if (typeof value === 'object' && value !== null && 'amount' in value) {
    const a = (value as { amount?: unknown }).amount;
    if (typeof a === 'string') {
      const s = a.trim();
      return s === '' ? null : s;
    }
    if (typeof a === 'number' && Number.isFinite(a)) return String(a);
  }
  return null;
}
