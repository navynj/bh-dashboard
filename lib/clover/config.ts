/**
 * Clover REST API: merchant token + merchant id per location (JSON map).
 * See https://docs.clover.com/dev/docs/using-rest-api
 */

export function getCloverApiBaseUrl(): string {
  return (
    process.env.CLOVER_API_BASE_URL?.trim() || 'https://api.clover.com'
  );
}

export function getCloverApiToken(): string | undefined {
  const t = process.env.CLOVER_API_TOKEN?.trim();
  return t || undefined;
}

export function isCloverConfigured(): boolean {
  return Boolean(getCloverApiToken());
}

/**
 * Resolve Clover merchant id for a location.
 * Prefer `CLOVER_MERCHANT_IDS_JSON` as `{"<locationId>":"<merchantId>",...}`,
 * fallback `CLOVER_MERCHANT_ID` for testing single-merchant setups.
 */
export function getCloverMerchantIdForLocation(
  locationId: string,
): string | null {
  const raw = process.env.CLOVER_MERCHANT_IDS_JSON?.trim();
  if (raw) {
    try {
      const map = JSON.parse(raw) as Record<string, string>;
      const id = map[locationId]?.trim();
      if (id) return id;
    } catch {
      // ignore invalid JSON
    }
  }
  const single = process.env.CLOVER_MERCHANT_ID?.trim();
  return single || null;
}
