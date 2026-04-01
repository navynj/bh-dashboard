import { getCloverApiBaseUrl, getCloverApiToken } from './config';

type CloverApiPayment = {
  id?: string;
  amount?: number;
  createdTime?: number;
  result?: string;
  tender?: {
    id?: string;
    label?: string;
  };
};

type CloverPaymentsResponse = {
  elements?: CloverApiPayment[];
};

const MAX_LIMIT = 1000;

/**
 * Fetch payments in [startMs, endMs] (Clover timestamps ms), with pagination.
 * Amounts are in cents. Only SUCCESS payments are included.
 */
export async function fetchCloverPaymentsInRange(
  merchantId: string,
  startMs: number,
  endMs: number,
): Promise<CloverApiPayment[]> {
  const token = getCloverApiToken();
  if (!token) {
    throw new Error('CLOVER_API_TOKEN is not set');
  }

  const base = getCloverApiBaseUrl().replace(/\/$/, '');
  const filter = `createdTime>=${startMs} AND createdTime<=${endMs}`;
  const out: CloverApiPayment[] = [];
  let offset = 0;

  for (;;) {
    const qs = new URLSearchParams({
      filter,
      expand: 'tender',
      limit: String(MAX_LIMIT),
      offset: String(offset),
    });
    const url = `${base}/v3/merchants/${merchantId}/payments?${qs.toString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Clover payments ${res.status}: ${text.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as CloverPaymentsResponse;
    const elements = json.elements ?? [];
    for (const p of elements) {
      if (p.result === 'SUCCESS' && typeof p.amount === 'number') {
        out.push(p);
      }
    }
    if (elements.length < MAX_LIMIT) break;
    offset += MAX_LIMIT;
  }

  return out;
}
