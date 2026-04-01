/**
 * Labor dashboard: P&L **Expense D** lines rolled into four labor buckets.
 */

import type { QuickBooksApiContext } from '@/features/dashboard/budget';
import { referenceCurrentMonthRange } from '@/features/dashboard/budget';
import { fetchPnlReport } from '@/lib/quickbooks/client';
import {
  parseExpenseDLineItemsFromReportRows,
  parseExpenseDTotalFromReportRows,
} from '@/lib/quickbooks/parser';
import type { LaborBudgetInput } from './compute-labor-target';
import { resolveLaborTargetFromBudget } from './compute-labor-target';
import type { LaborDashboardData } from '../types';

/** Fixed display order (matches product). */
export const LABOR_CATEGORY_DEF = [
  { id: 'management-fee', name: 'Management Fee' },
  { id: 'health-benefits', name: 'Health Benefits' },
  { id: 'tax', name: 'Tax' },
  { id: 'wage', name: 'Wage' },
] as const;

/**
 * Map an Expense D account name into one of the four labor categories.
 * Order of checks matters (e.g. tax vs wage).
 */
export function classifyExpenseDLineToLaborIndex(name: string): number {
  const n = name.toLowerCase();
  if (/management|mgmt\s*fee|^m\/e\b|admin\s*fee/i.test(n)) return 0;
  if (/health|benefit|401|medical|dental|vision|hmo|welfare|pto\s*acc/i.test(n))
    return 1;
  if (
    /\btax\b|fica|payroll\s*tax|suta|futa|withhold|federal\s+with|state\s+with/i.test(
      n,
    )
  )
    return 2;
  return 3;
}

export async function getLaborDashboardData(
  locationId: string,
  yearMonth: string,
  context: QuickBooksApiContext,
  budget: LaborBudgetInput | null | undefined,
): Promise<LaborDashboardData> {
  const { startDate, endDate } = referenceCurrentMonthRange(yearMonth);
  const { report } = await fetchPnlReport(
    context.baseUrl,
    context.cookie,
    locationId,
    startDate,
    endDate,
    'Accrual',
  );
  const lines = parseExpenseDLineItemsFromReportRows(report?.Rows);
  const sums = [0, 0, 0, 0];
  for (const line of lines) {
    const idx = classifyExpenseDLineToLaborIndex(line.name);
    sums[idx] += line.amount;
  }
  const categories = LABOR_CATEGORY_DEF.map((def, i) => ({
    id: def.id,
    name: def.name,
    amount: sums[i],
  }));
  const totalLabor = parseExpenseDTotalFromReportRows(report?.Rows);
  const {
    targetLabor,
    displayRate,
    displayPeriod,
    referenceIncomeTotal,
  } = resolveLaborTargetFromBudget(budget);
  return {
    totalLabor,
    targetLabor,
    displayRate,
    displayPeriod,
    referenceIncomeTotal,
    categories,
  };
}
