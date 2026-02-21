/**
 * Base Parser Logic
 * 
 * Common parsing logic shared between Period and Monthly modes.
 * Handles section identification, data extraction, and filtering.
 */

import type {
  QuickBooksRow,
  QuickBooksColData,
  MonthlyTransformContext,
} from '../types';
import { EXCLUSION_PATTERNS } from '../constants';

/**
 * Section type identifiers
 */
export enum SectionType {
  INCOME = 'INCOME',
  COST_OF_SALES = 'COST_OF_SALES',
  EXPENSES = 'EXPENSES',
  OTHER_INCOME = 'OTHER_INCOME',
  PROFIT = 'PROFIT',
  GROSS_PROFIT = 'GROSS_PROFIT',
}

/**
 * Identify section type from row data
 */
export function identifySectionType(row: QuickBooksRow): SectionType | null {
  const headerValue = row.Header?.ColData?.[0]?.value || '';
  const summary = row.Summary?.ColData;
  const summaryLabel = summary?.[0]?.value || '';
  const upperHeader = headerValue.toUpperCase();
  const upperSummary = summaryLabel.toUpperCase();

  // INCOME section
  if (upperHeader === 'INCOME' || row.group === 'Income') {
    return SectionType.INCOME;
  }

  // COST OF GOODS SOLD / COST OF SALES section
  if (
    upperHeader.includes('COST OF GOODS SOLD') ||
    upperHeader.includes('COST OF SALES') ||
    row.group === 'COGS'
  ) {
    return SectionType.COST_OF_SALES;
  }

  // EXPENSES section
  if (upperHeader === 'EXPENSES' || row.group === 'Expenses') {
    return SectionType.EXPENSES;
  }

  // OTHER INCOME section
  if (upperHeader.includes('OTHER INCOME') || row.group === 'OtherIncome') {
    return SectionType.OTHER_INCOME;
  }

  // PROFIT
  if (
    upperSummary === 'PROFIT' ||
    upperSummary === 'NET INCOME' ||
    row.group === 'NetIncome'
  ) {
    return SectionType.PROFIT;
  }

  // Gross Profit (usually appears as a summary between COGS and Expenses)
  if (
    upperSummary.includes('GROSS PROFIT') ||
    upperSummary.includes('GROSS INCOME')
  ) {
    return SectionType.GROSS_PROFIT;
  }

  return null;
}

/**
 * Check if expense header should be excluded (E17 Payroll Expenses or any "(deleted)" section)
 */
export function shouldExcludeExpenseSection(
  expenseHeader: string,
): boolean {
  const upperExpenseHeader = expenseHeader.toUpperCase();
  if (EXCLUSION_PATTERNS.deleted.test(expenseHeader)) return true;
  return (
    upperExpenseHeader === 'E17 PAYROLL EXPENSES' ||
    (upperExpenseHeader.startsWith('E17') &&
      upperExpenseHeader.includes('PAYROLL EXPENSES') &&
      !upperExpenseHeader.includes('L'))
  );
}

/**
 * Extract basic row data (header value, summary)
 */
export function extractRowData(row: QuickBooksRow): {
  headerValue: string;
  summary: QuickBooksColData[] | undefined;
  summaryLabel: string;
} {
  const headerValue = row.Header?.ColData?.[0]?.value || '';
  const summary = row.Summary?.ColData;
  const summaryLabel = summary?.[0]?.value || '';

  return {
    headerValue,
    summary,
    summaryLabel,
  };
}

/**
 * Extract expense row data
 */
export function extractExpenseRowData(expenseRow: QuickBooksRow): {
  expenseHeader: string;
  expenseSummary: QuickBooksColData[] | undefined;
  expenseSummaryLabel: string;
} {
  const expenseHeader = expenseRow.Header?.ColData?.[0]?.value || '';
  const expenseSummary = expenseRow.Summary?.ColData;
  const expenseSummaryLabel = expenseSummary?.[0]?.value || '';

  return {
    expenseHeader,
    expenseSummary,
    expenseSummaryLabel,
  };
}

/**
 * Check if row is an expense sub-section
 */
export function isExpenseSubSection(row: QuickBooksRow): boolean {
  const headerValue = row.Header?.ColData?.[0]?.value || '';
  return (
    headerValue.toUpperCase().includes('EXPENSE') &&
    !!row.Rows?.Row
  );
}

/**
 * Check if summary indicates total expenses
 */
export function isTotalExpenses(summaryLabel: string): boolean {
  const upper = summaryLabel.toUpperCase();
  return upper.includes('TOTAL') && upper.includes('EXPENSES');
}

/**
 * Extract period mode summary value (single value)
 */
export function extractPeriodSummaryValue(
  summary: QuickBooksColData[] | undefined,
): string {
  return summary?.[1]?.value || '';
}

/**
 * Extract monthly mode summary values (array of values + total)
 */
export function extractMonthlySummaryValues(
  summary: QuickBooksColData[] | undefined,
  numMonths: number,
): { values: string[]; total: string } {
  const values = summary
    ? summary
        .slice(1, -1)
        .slice(0, numMonths)
        .map((col) => col?.value || '0')
    : [];
  const total = summary
    ? summary[summary.length - 1]?.value || '0'
    : '0';
  return { values, total };
}

/**
 * Extract period mode expense summary value
 */
export function extractPeriodExpenseSummaryValue(
  expenseSummary: QuickBooksColData[] | undefined,
): string {
  return expenseSummary?.[1]?.value || '';
}

/**
 * Extract monthly mode expense summary values
 */
export function extractMonthlyExpenseSummaryValues(
  expenseSummary: QuickBooksColData[] | undefined,
  numMonths: number,
): { values: string[]; total: string } {
  const values = expenseSummary
    ? expenseSummary
        .slice(1, numMonths + 1)
        .map((col) => col?.value || '0')
    : [];
  const total = expenseSummary
    ? expenseSummary[expenseSummary.length - 1]?.value || '0'
    : '0';
  return { values, total };
}

/**
 * Create transform context for monthly mode
 */
export function createMonthlyTransformContext(
  numMonths: number,
  expenseSectionHeader?: string,
  indentLevel: number = 0,
  isIncomeSection: boolean = false,
): MonthlyTransformContext {
  return {
    expenseSectionHeader,
    indentLevel,
    isIncomeSection,
    keywordsFound: {
      foundClover: false,
      foundCourier: false,
    },
    numMonths,
  };
}
