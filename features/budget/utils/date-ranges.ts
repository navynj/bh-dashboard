/**
 * Compute date ranges for reference period and current month.
 * Exported for use by /api/quickbooks route handlers and budget reference data.
 */

/**
 * Compute start_date and end_date (YYYY-MM-DD) for a reference period of the last N months
 * *before* endYearMonth (i.e. ending at the previous month, not including endYearMonth).
 * Example: endYearMonth=2025-02, months=6 → 2024-08-01 ~ 2025-01-31 (Aug through Jan).
 */
export function referencePreviousMonthRange(
  endYearMonth: string,
  monthRange: number,
): { startDate: string; endDate: string } {
  const [y, m] = endYearMonth.split('-').map(Number);
  const month0 = (m ?? 1) - 1;
  const endOfRef = new Date(y, month0, 0);
  const endYear = endOfRef.getFullYear();
  const endMonth0 = endOfRef.getMonth();
  const lastDay = endOfRef.getDate();
  const start = new Date(endYear, endMonth0, 1);
  start.setMonth(start.getMonth() - monthRange + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    endDate: `${endYear}-${pad(endMonth0 + 1)}-${pad(lastDay)}`,
  };
}

export function referenceCurrentMonthRange(yearMonth: string): {
  startDate: string;
  endDate: string;
} {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  let current = new Date();
  if (y !== current.getFullYear() || current.getMonth() !== m - 1) {
    current = new Date(y, m, 0);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
    endDate: `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`,
  };
}
