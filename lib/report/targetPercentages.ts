/** Default target percentages when not set (COS, Payroll, Profit) */
export const DEFAULT_TARGET_PERCENTAGES = {
  costOfSales: 30,
  payroll: 25,
  profit: 15,
} as const;

export type TargetPercentagesInput = {
  costOfSales?: number;
  payroll?: number;
  profit?: number;
};

/**
 * Merge partial target percentages with defaults.
 * Used when generating PDF so targets always print (e.g. when Notion has no values).
 */
export function getTargetPercentagesWithDefaults(
  partial?: TargetPercentagesInput | null,
): {
  costOfSales: number;
  payroll: number;
  profit: number;
} {
  return {
    costOfSales:
      partial?.costOfSales ?? DEFAULT_TARGET_PERCENTAGES.costOfSales,
    payroll: partial?.payroll ?? DEFAULT_TARGET_PERCENTAGES.payroll,
    profit: partial?.profit ?? DEFAULT_TARGET_PERCENTAGES.profit,
  };
}

/**
 * Build targetPercentages object for the report API from form string values.
 * Returns undefined if all values are empty.
 */
export function buildTargetPercentages(
  costOfSales: string,
  payroll: string,
  profit: string
):
  | { costOfSales?: number; payroll?: number; profit?: number }
  | undefined {
  if (!costOfSales && !payroll && !profit) return undefined;
  return {
    ...(costOfSales ? { costOfSales: parseFloat(costOfSales) } : {}),
    ...(payroll ? { payroll: parseFloat(payroll) } : {}),
    ...(profit ? { profit: parseFloat(profit) } : {}),
  };
}
