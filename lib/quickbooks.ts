/**
 * QuickBooks Online API helpers: token from DB (per Location), refresh, OAuth, and P&L report.
 * Env: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_ENVIRONMENT;
 * optional QUICKBOOKS_*_SANDBOX for sandbox; QUICKBOOKS_REDIRECT_URI or NEXT_PUBLIC_APP_URL.
 * Access/refresh tokens and realmId come from Location in the DB (per locationId).
 */

import { decryptRefreshToken } from '@/lib/encryption';
import { AppError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import OAuthClient from 'intuit-oauth';

const QB_ENV = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
const QB_BASE =
  QB_ENV === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
const QB_OAUTH = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

/** Minutes before expiry to consider access token expired and refresh. */
const ACCESS_TOKEN_BUFFER_MINUTES = 5;

/** Resolve client id/secret for current QUICKBOOKS_ENVIRONMENT (production vs sandbox). */
function getQbClientCredentials(): {
  clientId: string | undefined;
  clientSecret: string | undefined;
  hasCredentials: boolean;
} {
  const isProd = QB_ENV === 'production';
  const clientId = isProd
    ? process.env.QUICKBOOKS_CLIENT_ID
    : (process.env.QUICKBOOKS_CLIENT_ID_SANDBOX ??
      process.env.QUICKBOOKS_CLIENT_ID);
  const clientSecret = isProd
    ? process.env.QUICKBOOKS_CLIENT_SECRET
    : (process.env.QUICKBOOKS_CLIENT_SECRET_SANDBOX ??
      process.env.QUICKBOOKS_CLIENT_SECRET);
  return {
    clientId,
    clientSecret,
    hasCredentials: !!clientId && !!clientSecret,
  };
}

/**
 * Redirect URI for QuickBooks OAuth. Used by connect flow and callback.
 * QUICKBOOKS_REDIRECT_URI or fallback from NEXT_PUBLIC_APP_URL / localhost.
 */
export function getQuickBooksRedirectUri(): string {
  return (
    process.env.QUICKBOOKS_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/quickbook/auth/callback`
  );
}

/**
 * OAuth scopes for QuickBooks. Use getDefaultQuickBooksScopes() for authorize URL.
 */
export const QUICKBOOKS_SCOPES = {
  Accounting: 'com.intuit.quickbooks.accounting',
  Payment: 'com.intuit.quickbooks.payment',
  Payroll: 'com.intuit.quickbooks.payroll',
  TimeTracking: 'com.intuit.quickbooks.payroll.timetracking',
  Benefits: 'com.intuit.quickbooks.payroll.benefits',
  OpenId: 'openid',
  Profile: 'profile',
  Email: 'email',
  Phone: 'phone',
  Address: 'address',
  IntuitName: 'intuit_name',
} as const;

/** Default scopes for OAuth authorization (accounting only for this app). */
export function getDefaultQuickBooksScopes(): string[] {
  return [QUICKBOOKS_SCOPES.Accounting];
}

/**
 * Configured QuickBooks OAuth client for authorize URL and token exchange.
 * Uses QUICKBOOKS_ENVIRONMENT to pick production vs sandbox credentials.
 * @throws AppError if client id/secret not set
 */
export function getQuickBooksOAuthClient(): OAuthClient {
  const { clientId, clientSecret, hasCredentials } = getQbClientCredentials();
  if (!hasCredentials || !clientId || !clientSecret) {
    throw new AppError(
      'QuickBooks not configured: set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET (or *_SANDBOX for sandbox)',
    );
  }
  return new OAuthClient({
    clientId,
    clientSecret,
    environment: QB_ENV as 'sandbox' | 'production',
    redirectUri: getQuickBooksRedirectUri(),
  });
}

/**
 * Refresh QuickBooks access token using a refresh token string.
 * Returns new access_token, refresh_token, expires_in. Caller persists to DB.
 */
export async function refreshQuickBooksTokens(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  // If token was synced from bhpnl (encrypted), decrypt before sending to Intuit
  const tokenToSend = decryptRefreshToken(refreshToken);

  const { clientId, clientSecret } = getQbClientCredentials();
  if (!clientId || !clientSecret) {
    throw new AppError(
      'QuickBooks not configured: set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET',
    );
  }
  const res = await fetch(QB_OAUTH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenToSend,
    }).toString(),
  });
  if (!res.ok) {
    const errText = await res.text();
    let errJson: { error?: string; error_description?: string } | null = null;
    try {
      errJson = JSON.parse(errText) as {
        error?: string;
        error_description?: string;
      };
    } catch {
      // ignore
    }
    const isRefreshExpired =
      res.status === 400 &&
      (errJson?.error === 'invalid_grant' ||
        /refresh_token.*expired|token.*expired/i.test(
          errJson?.error_description ?? errText,
        ));
    const detail = errJson?.error_description || errText;
    if (isRefreshExpired) {
      throw new AppError(
        `QuickBooks connection expired. Please reconnect QuickBooks for this location. (Intuit: ${errJson?.error ?? ''} – ${detail})`,
        'QB_REFRESH_EXPIRED',
      );
    }
    throw new AppError(
      `QuickBooks token refresh failed: ${res.status} ${errJson?.error ?? ''} – ${detail}`,
    );
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return data;
}

/**
 * Get a valid access token for a location. Reads tokens from Location in DB.
 * If access token is expired or expiring within buffer, refreshes and updates Location.
 * Throws AppError when QB client not configured, location has no refresh token, or refresh fails.
 */
export async function getValidAccessTokenForLocation(
  locationId: string,
): Promise<string> {
  const { hasCredentials } = getQbClientCredentials();
  if (!hasCredentials) {
    throw new AppError(
      'QuickBooks not configured: set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET',
    );
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { accessToken: true, refreshToken: true, expiresAt: true },
  });

  if (!location) {
    throw new AppError('Location not found');
  }
  if (!location.refreshToken) {
    throw new AppError(
      'Location has no QuickBooks refresh token; connect QuickBooks for this location.',
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expiryBufferSec = ACCESS_TOKEN_BUFFER_MINUTES * 60;
  const accessExpired =
    location.expiresAt == null ||
    location.expiresAt.getTime() <= nowSec + expiryBufferSec;

  if (!accessExpired && location.accessToken) {
    return location.accessToken;
  }

  try {
    const data = await refreshQuickBooksTokens(location.refreshToken);
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    await prisma.location.update({
      where: { id: locationId },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
      },
    });

    return data.access_token;
  } catch (e) {
    if (e instanceof AppError && e.code === 'QB_REFRESH_EXPIRED') {
      throw new AppError(e.message, e.code, { locationId });
    }
    throw e;
  }
}

const QB_401_PATTERN =
  /401|Unauthorized|AuthorizationFailure|Authorization Fault/i;

/**
 * Run an async operation that needs a valid access token and realmId for a location.
 * On 401, refreshes the token and retries the operation once.
 * Use for getReferenceIncomeAndCos, getCurrentMonthCos, or any other QB API call per location.
 */
export async function withValidTokenForLocation<T>(
  locationId: string,
  fn: (accessToken: string, realmId: string) => Promise<T>,
): Promise<T> {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { realmId: true, refreshToken: true },
  });

  if (!location?.realmId) {
    throw new AppError('Location has no QuickBooks realm');
  }
  const realmId = decryptRefreshToken(location.realmId);

  const tryRun = async (): Promise<T> => {
    const accessToken = await getValidAccessTokenForLocation(locationId);
    return fn(accessToken, realmId);
  };

  try {
    return await tryRun();
  } catch (err) {
    const is401 = err instanceof Error && QB_401_PATTERN.test(err.message);
    if (is401 && location.refreshToken) {
      try {
        const data = await refreshQuickBooksTokens(location.refreshToken);
        const nowSec = Math.floor(Date.now() / 1000);
        await prisma.location.update({
          where: { id: locationId },
          data: {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date((nowSec + data.expires_in) * 1000),
          },
        });
        return tryRun();
      } catch (refreshErr) {
        const isRefreshExpired =
          refreshErr instanceof AppError &&
          (refreshErr as AppError).code === 'QB_REFRESH_EXPIRED';
        console.error('QuickBooks token refresh on 401 failed:', refreshErr);
        if (isRefreshExpired) {
          throw new AppError(
            'QuickBooks refresh token in this app is stale (the other app may have refreshed and invalidated it). ' +
              'Copy the current refresh_token from bhpnl’s DB (decrypted) into this location’s refresh_token, or reconnect QuickBooks for this location in this app.',
            'QB_REFRESH_EXPIRED',
            { locationId },
          );
        }
      }
    }
    throw err;
  }
}

/** Parsed P&L: total income and Cost of Goods Sold line items (category name + amount). */
export type ProfitAndLossParsed = {
  incomeTotal?: number;
  cosTotal?: number;
  cosByCategory?: { categoryId: string; name: string; amount: number }[];
};

function parseAmount(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const s = String(value).replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : Math.abs(n);
}

/** Recursively find section by header title (e.g. "Income", "Cost of Goods Sold"). */
function findSection(
  rows: { Row?: unknown[] } | undefined,
  titleMatch: (title: string) => boolean,
): unknown | undefined {
  const rowList = Array.isArray(rows?.Row) ? rows.Row : [];
  for (const row of rowList) {
    const header = (row as { Header?: { ColData?: { value?: string }[] } })
      ?.Header?.ColData?.[0]?.value;
    if (header && titleMatch(header)) return row;
    const group = (row as { group?: string }).group;
    if (group && titleMatch(group)) return row;
  }
  return undefined;
}

/** Extract numeric total from a row (Summary or ColData). */
function rowTotal(row: unknown): number {
  const r = row as {
    Summary?: { ColData?: { value?: unknown }[] };
    ColData?: { value?: unknown }[];
  };
  const summary = r?.Summary?.ColData;
  if (Array.isArray(summary)) {
    for (let i = 1; i < summary.length; i++) {
      const v = parseAmount(summary[i]?.value);
      if (v > 0) return v;
    }
    return parseAmount(summary[0]?.value);
  }
  const colData = r?.ColData;
  if (Array.isArray(colData) && colData.length >= 2) {
    return parseAmount(colData[1]?.value ?? colData[colData.length - 1]?.value);
  }
  return 0;
}

/** Row shape for P&L: line item (ColData), or group with Header + Rows.Row. */
type PlRow = {
  ColData?: { value?: string }[];
  Rows?: { Row?: PlRow[] };
  Header?: { ColData?: { value?: string }[] };
  Summary?: { ColData?: { value?: unknown }[] };
};

function lineName(row: PlRow): string {
  const cols = row?.ColData;
  if (!Array.isArray(cols) || cols.length < 1) return '';
  return (cols[0]?.value ?? '').trim();
}

/** Category/row name: Header (for Section rows) or ColData (for Data rows). */
function categoryOrLineName(row: PlRow): string {
  const header = row?.Header?.ColData?.[0]?.value;
  if (header != null && String(header).trim()) return String(header).trim();
  return lineName(row);
}

/**
 * Extract line items from a section (one level only). Used for Income.
 */
function sectionLineItems(
  row: unknown,
): { id: string; name: string; amount: number }[] {
  const r = row as { Rows?: { Row?: PlRow[] } };
  const out: { id: string; name: string; amount: number }[] = [];
  const rowList = Array.isArray(r?.Rows?.Row) ? r.Rows.Row : [];
  rowList.forEach((item, idx) => {
    const name = lineName(item);
    if (!name) return;
    const amount = rowTotal(item);
    out.push({
      id: `qb-${idx}-${name.replace(/\s+/g, '-')}`,
      name,
      amount,
    });
  });
  return out;
}

/**
 * Extract COS categories and their direct subcategories (one level).
 * - Category name from Header.ColData[0] (Section) or ColData[0] (Data).
 * - Amounts from Summary when present, else ColData.
 * - Skips the trailing "Cost of Goods Sold" total line (same as section title).
 */
function sectionCosLineItems(
  row: unknown,
): { id: string; name: string; amount: number }[] {
  const r = row as { Rows?: { Row?: PlRow[] } };
  const out: { id: string; name: string; amount: number }[] = [];
  const rowList = Array.isArray(r?.Rows?.Row) ? r.Rows.Row : [];

  rowList.forEach((category, catIdx) => {
    const catName = categoryOrLineName(category);
    if (!catName) return;
    // Skip the duplicate total line (Data row named "Cost of Goods Sold" at end of section)
    if (
      !category?.Header &&
      /^cost of (goods )?sold$/i.test(catName.trim())
    ) {
      return;
    }

    // 1. Emit the category line (COS1, COS2, ... COS7)
    out.push({
      id: `qb-${catIdx}-${catName.replace(/\s+/g, '-')}`,
      name: catName,
      amount: rowTotal(category),
    });

    // 2. Emit one level of subcategories only (name + Summary amount)
    const subRows = category?.Rows?.Row;
    if (!Array.isArray(subRows) || subRows.length === 0) return;

    subRows.forEach((sub, subIdx) => {
      const subName = categoryOrLineName(sub);
      if (!subName) return;
      out.push({
        id: `qb-${catIdx}-${subIdx}-${subName.replace(/\s+/g, '-')}`,
        name: subName,
        amount: rowTotal(sub),
      });
    });
  });

  return out;
}

/** Parse income total from P&L report Rows. */
export function parseIncomeFromReportRows(
  rows: { Row?: unknown[] } | undefined,
): number {
  const incomeSection = findSection(rows, (t) => /^income$/i.test(t.trim()));
  if (!incomeSection) return 0;
  return rowTotal(incomeSection);
}

/** Parse Cost of Sales total from P&L report Rows (section Summary total). */
export function parseCosTotalFromReportRows(
  rows: { Row?: unknown[] } | undefined,
): number {
  const cosSection = findSection(rows, (t) =>
    /cost of (goods )?sold|cost of sales|cogs/i.test(t.trim()),
  );
  if (!cosSection) return 0;
  return rowTotal(cosSection);
}

/** Parse Cost of Goods Sold categories from P&L report Rows. */
export function parseCosFromReportRows(
  rows: { Row?: unknown[] } | undefined,
): { categoryId: string; name: string; amount: number }[] {
  const cosSection = findSection(rows, (t) =>
    /cost of (goods )?sold|cost of sales|cogs/i.test(t.trim()),
  );
  if (!cosSection) return [];

  return sectionCosLineItems(cosSection).map((c) => ({
    categoryId: c.id,
    name: c.name,
    amount: c.amount,
  }));
}

/** Controls which P&L data to parse and return. */
export type ProfitAndLossDataOption = 'income,cos' | 'cos';

/**
 * Fetch Profit and Loss report from QuickBooks and parse requested data.
 * @param accessToken - Valid QuickBooks access token (e.g. from getValidAccessTokenForLocation).
 * @param dataOption - 'income,cos': return income total + COS categories. 'cos': return COS categories only.
 */
export async function fetchProfitAndLossReport(
  realmId: string,
  startDate: string,
  endDate: string,
  accountingMethod: 'Accrual' | 'Cash' = 'Accrual',
  dataOption: ProfitAndLossDataOption = 'income,cos',
  accessToken: string,
): Promise<ProfitAndLossParsed> {
  // If realmId was synced from bhpnl (encrypted), decrypt before use
  const resolvedRealmId = decryptRefreshToken(realmId);
  const url = `${QB_BASE}/v3/company/${resolvedRealmId}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&accounting_method=${accountingMethod}`;

  const QB_FETCH_TIMEOUT_MS = 25_000;

  const doFetch = (token: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QB_FETCH_TIMEOUT_MS);
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  };

  let res: Response;
  try {
    res = await doFetch(accessToken);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new AppError(
        'QuickBooks P&L request timed out. The service may be slow or unreachable.',
      );
    }
    throw e;
  }

  if (res.status === 401) {
    const err = await res.text();
    throw new AppError(
      `QuickBooks P&L request failed: 401 Unauthorized. ${err}. ` +
        'Ensure this app uses the same QuickBooks client id/secret as the connection, and that the location’s realmId matches the connected company. Try reconnecting QuickBooks for this location.',
    );
  }

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`QuickBooks P&L request failed: ${res.status} ${err}`);
  }
  const report = (await res.json()) as {
    Rows?: { Row?: unknown[] };
  };
  const rows = report?.Rows;

  switch (dataOption) {
    case 'income,cos':
      return {
        incomeTotal: parseIncomeFromReportRows(rows),
        cosTotal: parseCosTotalFromReportRows(rows),
        cosByCategory: parseCosFromReportRows(rows),
      };
    case 'cos':
      return {
        cosTotal: parseCosTotalFromReportRows(rows),
        cosByCategory: parseCosFromReportRows(rows),
      };
  }
}

/**
 * Check if QuickBooks app is configured (client id/secret). Does not check DB tokens.
 */
export function isQuickBooksConfigured(): boolean {
  return getQbClientCredentials().hasCredentials;
}
