/**
 * Call GET /api/quickbooks/pnl from client/server to get P&L report (e.g. for budget).
 */

import { cache } from 'react';
import { AppError } from '@/lib/core/errors';
import type { PnlReportData } from './parser';

export type PnlApiResponse = {
  ok: boolean;
  locationId: string;
  location: { id: string; code: string | null; name: string | null };
  startDate: string;
  endDate: string;
  accountingMethod: 'Accrual' | 'Cash';
  report: PnlReportData;
};

/**
 * Fetch a QuickBooks P&L report via the internal API route.
 * Wrapped with React.cache() so identical calls within one SSR render
 * (e.g. budget COS + monthly revenue + labor all requesting the same month)
 * are deduplicated to a single network request.
 */
export const fetchPnlReport = cache(async function fetchPnlReport(
  baseUrl: string,
  cookie: string | null,
  locationId: string,
  startDate: string,
  endDate: string,
  accountingMethod: 'Accrual' | 'Cash' = 'Accrual',
): Promise<PnlApiResponse> {
  const url = new URL('/api/quickbooks/pnl', baseUrl.replace(/\/$/, ''));
  url.searchParams.set('locationId', locationId);
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('accountingMethod', accountingMethod);

  const res = await fetch(url.toString(), {
    headers: { Cookie: cookie ?? '' },
    cache: 'no-store',
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new AppError(
      `QuickBooks P&L API failed: ${res.status} ${raw || res.statusText}`,
    );
  }

  let data: PnlApiResponse;
  try {
    data = JSON.parse(raw) as PnlApiResponse;
  } catch {
    const looksLikeHtml = raw.trimStart().startsWith('<');
    const hint = looksLikeHtml
      ? 'Received HTML instead of JSON — the internal fetch URL likely does not match this app (e.g. NEXT_PUBLIC_APP_URL vs the URL in your browser).'
      : 'Response body is not valid JSON.';
    const preview = raw.slice(0, 200).replace(/\s+/g, ' ');
    throw new AppError(
      `QuickBooks P&L API failed: ${hint} Status ${res.status}. Body preview: ${preview}`,
    );
  }

  if (!data.report) {
    throw new AppError('QuickBooks P&L API returned no report');
  }
  return data;
});
