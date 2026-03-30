/**
 * Fetch reference income/COS and current-month COS via QuickBooks P&L (GET /api/quickbooks/pnl).
 */

import { decryptRefreshToken } from '@/lib/core/encryption';
import { AppError } from '@/lib/core/errors';
import { prisma } from '@/lib/core/prisma';
import {
  fetchPnlReport,
  getBudgetDataFromPnlReport,
  getCosFromPnlReport,
  isQuickBooksConfigured,
} from '@/lib/quickbooks';
import type { ReferenceData, QuickBooksApiContext } from '../types';
import { referencePreviousMonthRange, referenceCurrentMonthRange } from './date-ranges';
import { formatYearMonth } from '@/lib/utils/date';

/** Get the realmId for a location. Throws AppError when QB not configured or location has no realm. */
export async function getRealmIdByLocation(locationId: string): Promise<string> {
  if (!isQuickBooksConfigured()) {
    throw new AppError('QuickBooks is not configured');
  }
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { realm: { select: { realmId: true } } },
  });
  if (!location?.realm?.realmId) {
    throw new AppError('Location has no QuickBooks realm');
  }
  return decryptRefreshToken(location.realm.realmId);
}

export async function getReferenceIncomeAndCos(
  _userId: string,
  locationId: string,
  endYearMonth: string,
  months: number,
  context: QuickBooksApiContext,
): Promise<ReferenceData> {
  if (!isQuickBooksConfigured()) {
    throw new AppError('QuickBooks is not configured');
  }
  try {
    const { startDate, endDate } = referencePreviousMonthRange(
      endYearMonth,
      months,
    );
    const { report } = await fetchPnlReport(
      context.baseUrl,
      context.cookie,
      locationId,
      startDate,
      endDate,
      'Accrual',
    );
    const data = getBudgetDataFromPnlReport(report);
    return {
      incomeTotal: data.incomeTotal,
      cosTotal: data.cosTotal,
      cosByCategory: data.cosByCategory,
    };
  } catch (err) {
    console.error('QuickBooks P&L API failed:', err);
    const message =
      err instanceof Error ? err.message : 'QuickBooks P&L fetch failed';
    const code = err instanceof AppError ? err.code : undefined;
    const details =
      err instanceof AppError && err.details
        ? { ...err.details, locationId }
        : { locationId };
    throw new AppError(message, code, details);
  }
}

export async function getCurrentMonthCos(
  locationId: string,
  date: { year: number; month: number },
  _months: number,
  context: QuickBooksApiContext,
): Promise<{
  cosTotal?: number;
  cosByCategory?: { categoryId: string; name: string; amount: number }[];
}> {
  const dateString = formatYearMonth(date.year, date.month);
  const { startDate, endDate } = referenceCurrentMonthRange(dateString);
  const { report } = await fetchPnlReport(
    context.baseUrl,
    context.cookie,
    locationId,
    startDate,
    endDate,
    'Accrual',
  );
  const { cosTotal, cosByCategory } = getCosFromPnlReport(report);
  return {
    cosTotal: cosTotal || cosByCategory.reduce((s, c) => s + c.amount, 0),
    cosByCategory,
  };
}
