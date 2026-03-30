/**
 * Aggregate revenue dashboard data from QuickBooks P&L (Income total + Income by account)
 * and budget metadata (reference income, rate, period).
 */

import {
  getBudgetByLocationAndMonth,
  referenceCurrentMonthRange,
} from '@/features/dashboard/budget';
import type { QuickBooksApiContext } from '@/features/dashboard/budget';
import { getReferenceIncomeAndCos } from '@/features/dashboard/budget/utils/reference-data';
import { isQuickBooksConfigured } from '@/lib/quickbooks/config';
import {
  getTopLevelCategoryIndex,
  getTopLevelCategoryRows,
} from '@/features/report/utils/category';
import { fetchPnlReport } from '@/lib/quickbooks/client';
import { getIncomeWithCategoriesFromPnlReport } from '@/lib/quickbooks';
import type { RevenuePeriodData } from '../components/types';
import { eachDayOfInterval, format } from 'date-fns';
import { weekRangeForMonth } from './week-range';

export type PrecomputedRevenueBudget = {
  budget: Awaited<ReturnType<typeof getBudgetByLocationAndMonth>>;
  monthlyTargetIncome: number;
};

export type GetRevenuePeriodOptions = {
  period: 'weekly' | 'monthly';
  /** Weeks from the first Monday-aligned week of the selected month (weekly only). */
  weekOffset: number;
  /** When false, skip 7 per-day P&L calls (weekly only). */
  includeDailyBars?: boolean;
  /**
   * When loading monthly + weekly in parallel (e.g. location page), pass once to avoid duplicate
   * `getBudgetByLocationAndMonth` and `resolveMonthlyTargetIncome` / reference-income QB calls.
   */
  precomputed?: PrecomputedRevenueBudget;
};

/** From an attached budget (e.g. after attachReferenceCosToBudgets) — not on DB-only budget rows. */
export type RevenueBudgetMetadata = {
  referenceIncomeTotal?: number;
  referencePeriodMonthsUsed?: number | null;
  budgetRateUsed?: number | null;
};

function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

export async function resolveMonthlyTargetIncome(
  locationId: string,
  yearMonth: string,
  budget: Awaited<ReturnType<typeof getBudgetByLocationAndMonth>>,
  meta: RevenueBudgetMetadata | undefined,
  userId: string | undefined,
  context: QuickBooksApiContext,
): Promise<number> {
  const months =
    meta?.referencePeriodMonthsUsed ?? budget?.referencePeriodMonthsUsed;
  if (months == null || months <= 0) return 0;

  let refIncome = meta?.referenceIncomeTotal;
  if (refIncome == null || !Number.isFinite(refIncome)) {
    refIncome = (budget as { referenceIncomeTotal?: number })
      ?.referenceIncomeTotal;
  }
  if (
    (refIncome == null || !Number.isFinite(refIncome)) &&
    userId &&
    isQuickBooksConfigured()
  ) {
    try {
      const ref = await getReferenceIncomeAndCos(
        userId,
        locationId,
        yearMonth,
        months,
        context,
      );
      const inc = ref.incomeTotal;
      refIncome = inc != null && Number.isFinite(inc) ? inc : undefined;
    } catch {
      refIncome = undefined;
    }
  }
  if (refIncome == null || !Number.isFinite(refIncome)) return 0;
  return refIncome / months;
}

function incomeRowsToCategories(
  rows: { categoryId: string; name: string; amount: number }[],
): RevenuePeriodData['categories'] {
  return [...(rows ?? [])].map((r) => ({
    id: r.categoryId,
    name: r.name,
    amount: r.amount,
  }));
}

type IncomeTopRow = { categoryId: string; name: string; amount: number };

/** Display name에서 첫 숫자 덩어리(연속 숫자)를 파싱; 없으면 null. */
function firstNumberInDisplayName(name: string): number | null {
  const m = name.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/** 둘 다 이름에 숫자가 있으면 숫자 순, 그렇지 않거나 숫자 동률이면 기존 COA 인덱스 + categoryId. */
function compareSegmentKeys(
  a: string,
  b: string,
  idToName: Map<string, string>,
): number {
  const numA = firstNumberInDisplayName(idToName.get(a) ?? a);
  const numB = firstNumberInDisplayName(idToName.get(b) ?? b);
  if (numA !== null && numB !== null && numA !== numB) {
    return numA - numB;
  }
  return (
    getTopLevelCategoryIndex(a) - getTopLevelCategoryIndex(b) ||
    a.localeCompare(b)
  );
}

async function fetchDailyBars(
  locationId: string,
  weekStart: Date,
  weekEnd: Date,
  context: QuickBooksApiContext,
): Promise<{
  rows: NonNullable<RevenuePeriodData['dailyBars']>;
  segmentKeys: string[];
  segmentLabels: string[];
  /** Sum of each day’s P&L income total (matches stacked bar totals). */
  weekIncomeTotal: number;
  /** Top-level income rows aggregated across the week (same ids/order as segmentKeys). */
  weekRowsTopLevel: IncomeTopRow[];
}> {
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const dayResults = await Promise.all(
    days.map(async (day) => {
      const d = format(day, 'yyyy-MM-dd');
      try {
        const { report } = await fetchPnlReport(
          context.baseUrl,
          context.cookie,
          locationId,
          d,
          d,
          'Accrual',
        );
        const { incomeTotal, incomeByCategory } =
          getIncomeWithCategoriesFromPnlReport(report);
        const dayRows = getTopLevelCategoryRows(incomeByCategory ?? []);
        return {
          label: format(day, 'EEE').toUpperCase().slice(0, 3),
          dayRows,
          total: incomeTotal,
        };
      } catch {
        return {
          label: format(day, 'EEE').toUpperCase().slice(0, 3),
          dayRows: [] as IncomeTopRow[],
          total: 0,
        };
      }
    }),
  );

  /** Collect ids in encounter order, then sort so order is stable across weeks (see below). */
  const segmentKeys: string[] = [];
  const idSeen = new Set<string>();
  const idToName = new Map<string, string>();
  for (const day of dayResults) {
    for (const r of day.dayRows) {
      if (!idSeen.has(r.categoryId)) {
        idSeen.add(r.categoryId);
        segmentKeys.push(r.categoryId);
      }
      if (!idToName.has(r.categoryId)) {
        idToName.set(r.categoryId, r.name);
      }
    }
  }
  // 주차마다 first-seen 순서가 달라질 수 있어 정렬. 이름에 숫자가 있으면 숫자 우선, 아니면 COA 순.
  segmentKeys.sort((a, b) => compareSegmentKeys(a, b, idToName));
  const segmentLabels = segmentKeys.map((id) => idToName.get(id) ?? id);

  const weekIncomeTotal = dayResults.reduce((s, d) => s + d.total, 0);
  const amountById = new Map<string, number>();
  for (const day of dayResults) {
    for (const r of day.dayRows) {
      amountById.set(
        r.categoryId,
        (amountById.get(r.categoryId) ?? 0) + r.amount,
      );
    }
  }
  const weekRowsTopLevel: IncomeTopRow[] = segmentKeys.map((id) => ({
    categoryId: id,
    name: idToName.get(id) ?? id,
    amount: amountById.get(id) ?? 0,
  }));

  const rows: NonNullable<RevenuePeriodData['dailyBars']> = dayResults.map(
    (day) => {
      const segments: Record<string, number> = Object.fromEntries(
        segmentKeys.map((id) => [id, 0]),
      );
      for (const r of day.dayRows) {
        if (r.categoryId in segments) {
          segments[r.categoryId] = r.amount;
        }
      }
      return {
        label: day.label,
        segments,
        total: day.total,
      };
    },
  );

  return {
    rows,
    segmentKeys,
    segmentLabels,
    weekIncomeTotal,
    weekRowsTopLevel,
  };
}

/**
 * Load revenue period data: P&L Income (total + top-level income accounts), targets from budget reference.
 */
export async function getRevenuePeriodData(
  locationId: string,
  yearMonth: string,
  context: QuickBooksApiContext,
  options: GetRevenuePeriodOptions,
  budgetMeta?: RevenueBudgetMetadata,
  userId?: string,
): Promise<RevenuePeriodData> {
  const pre = options.precomputed;
  const budget = pre
    ? pre.budget
    : await getBudgetByLocationAndMonth(locationId, yearMonth);
  const mt = pre
    ? pre.monthlyTargetIncome
    : await resolveMonthlyTargetIncome(
        locationId,
        yearMonth,
        budget,
        budgetMeta,
        userId,
        context,
      );

  if (options.period === 'monthly') {
    const { startDate, endDate } = referenceCurrentMonthRange(yearMonth);
    const { report } = await fetchPnlReport(
      context.baseUrl,
      context.cookie,
      locationId,
      startDate,
      endDate,
      'Accrual',
    );
    const { incomeTotal, incomeByCategory } =
      getIncomeWithCategoriesFromPnlReport(report);
    const rows = getTopLevelCategoryRows(incomeByCategory ?? []);
    return {
      totalRevenue: incomeTotal,
      targetRevenue: mt,
      categories: incomeRowsToCategories(rows),
    };
  }

  const includeDaily = options.includeDailyBars !== false;
  const { startDate, endDate, weekStart, weekEnd } = weekRangeForMonth(
    yearMonth,
    options.weekOffset,
  );

  const dim = daysInMonth(yearMonth);
  const weeklyTarget = mt > 0 && dim > 0 ? (mt * 7) / dim : 0;

  if (includeDaily) {
    const daily = await fetchDailyBars(locationId, weekStart, weekEnd, context);
    const categories = incomeRowsToCategories(daily.weekRowsTopLevel);
    return {
      totalRevenue: daily.weekIncomeTotal,
      targetRevenue: weeklyTarget,
      categories,
      dailyBars: daily.rows,
      dailyBarSegmentKeys: daily.segmentKeys,
      dailyBarSegmentLabels: daily.segmentLabels,
    };
  }

  const { report } = await fetchPnlReport(
    context.baseUrl,
    context.cookie,
    locationId,
    startDate,
    endDate,
    'Accrual',
  );
  const { incomeTotal, incomeByCategory } =
    getIncomeWithCategoriesFromPnlReport(report);
  const rows = getTopLevelCategoryRows(incomeByCategory ?? []);
  const categories = incomeRowsToCategories(rows);

  return {
    totalRevenue: incomeTotal,
    targetRevenue: weeklyTarget,
    categories,
  };
}
