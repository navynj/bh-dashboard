/** Defaults when budget row has no overrides (match product: 25% × 6‑month ref). */
export const DEFAULT_LABOR_RATE = 0.25;
export const DEFAULT_LABOR_REFERENCE_MONTHS = 6;

export type LaborBudgetInput = {
  referenceIncomeTotal?: number | null;
  referencePeriodMonthsUsed?: number | null;
  budgetRateUsed?: number | null;
};

/**
 * Labor target = rate × (reference income total ÷ reference months),
 * i.e. rate × average monthly income over the reference period.
 */
export function resolveLaborTargetFromBudget(
  budget: LaborBudgetInput | null | undefined,
): {
  targetLabor: number;
  displayRate: number;
  displayPeriod: number;
  referenceIncomeTotal: number | null;
} {
  const rateRaw = budget?.budgetRateUsed;
  const rate =
    rateRaw != null &&
    Number.isFinite(Number(rateRaw)) &&
    Number(rateRaw) > 0
      ? Number(rateRaw)
      : DEFAULT_LABOR_RATE;

  const monthsRaw = budget?.referencePeriodMonthsUsed;
  const displayPeriod =
    monthsRaw != null && Number(monthsRaw) > 0
      ? Number(monthsRaw)
      : DEFAULT_LABOR_REFERENCE_MONTHS;

  const refIncome =
    budget?.referenceIncomeTotal != null &&
    Number.isFinite(Number(budget.referenceIncomeTotal))
      ? Number(budget.referenceIncomeTotal)
      : 0;

  const referenceIncomeTotal = refIncome > 0 ? refIncome : null;
  const targetLabor =
    refIncome > 0 ? (refIncome / displayPeriod) * rate : 0;

  return {
    targetLabor,
    displayRate: rate,
    displayPeriod,
    referenceIncomeTotal,
  };
}
