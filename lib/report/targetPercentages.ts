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
