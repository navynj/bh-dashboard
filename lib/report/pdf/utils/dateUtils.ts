import type { ReportData } from '../types';

export type MonthInfo = { year: number; month: number };

/**
 * Extract months from QuickBooks report data columns
 * Looks for columns with StartDate and EndDate in MetaData
 */
export function extractMonthsFromReportData(
  reportData: ReportData,
): MonthInfo[] {
  const header = reportData.Header || {};
  const isMonthlyMode = header.SummarizeColumnsBy === 'Month';
  let months: MonthInfo[] = [];

  // Extract months from Columns if monthly mode
  if (isMonthlyMode) {
    const columns = reportData.Columns?.Column || [];
    // Skip first column (Account label) and last column (Total)
    // Get month columns (they have StartDate and EndDate in MetaData)
    const monthColumns = columns.filter((col: any) => {
      if (!col.MetaData) return false;
      const hasStartDate = col.MetaData.some(
        (meta: any) => meta.Name === 'StartDate',
      );
      const hasEndDate = col.MetaData.some(
        (meta: any) => meta.Name === 'EndDate',
      );
      return hasStartDate && hasEndDate;
    });

    // Extract year and month from StartDate
    // Parse date string directly to avoid timezone issues
    // QuickBooks returns dates in "YYYY-MM-DD" format
    months = monthColumns
      .map((col: any) => {
        const startDateMeta = col.MetaData.find(
          (meta: any) => meta.Name === 'StartDate',
        );
        if (startDateMeta && startDateMeta.Value) {
          // Parse "YYYY-MM-DD" format directly to avoid timezone conversion
          const dateStr = startDateMeta.Value;
          const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            const year = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10); // Already 1-12 format
            return {
              year,
              month,
            };
          }
        }
        return null;
      })
      .filter((m): m is MonthInfo => m !== null);
  }

  // Fallback: check for legacy _monthlyMode flag
  if (!isMonthlyMode) {
    const legacyMonthlyMode = (reportData as any)._monthlyMode === true;
    const legacyMonths = (reportData as any)._months || [];
    if (legacyMonthlyMode && legacyMonths.length > 0) {
      months = legacyMonths;
    }
  }

  return months;
}

/**
 * Check if report is in monthly mode
 */
export function isMonthlyMode(reportData: ReportData): boolean {
  const header = reportData.Header || {};
  const isMonthlyMode = header.SummarizeColumnsBy === 'Month';
  if (isMonthlyMode) return true;

  // Fallback: check for legacy _monthlyMode flag
  const legacyMonthlyMode = (reportData as any)._monthlyMode === true;
  const legacyMonths = (reportData as any)._months || [];
  return legacyMonthlyMode && legacyMonths.length > 0;
}
