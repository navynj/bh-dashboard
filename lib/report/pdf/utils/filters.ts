/**
 * Filtering Utilities
 * 
 * Provides filtering and exclusion functions for PDF generation.
 */

import { EXCLUSION_PATTERNS, INCOME_KEYWORDS } from '../constants';

/**
 * Check if a label should be excluded based on E17 Payroll Expenses pattern
 */
export function isE17PayrollExpenses(label: string): boolean {
  return (
    EXCLUSION_PATTERNS.e17PayrollExpenses.test(label) ||
    (label.toUpperCase().startsWith('E17') &&
      /PAYROLL\s+EXPENSES/.test(label.toUpperCase()) &&
      !label.toUpperCase().includes('L'))
  );
}

/**
 * Check if a label should be excluded from Expense C section
 */
export function shouldExcludeFromExpenseC(
  label: string,
  expenseSectionHeader?: string
): boolean {
  if (!expenseSectionHeader) return false;
  return (
    EXCLUSION_PATTERNS.expenseC.test(expenseSectionHeader) &&
    EXCLUSION_PATTERNS.onlineSubscription.test(label)
  );
}

/**
 * Check if a label should be excluded from Expense E section
 */
export function shouldExcludeFromExpenseE(
  label: string,
  expenseSectionHeader?: string
): boolean {
  if (!expenseSectionHeader) return false;
  return (
    EXCLUSION_PATTERNS.expenseE.test(expenseSectionHeader) &&
    EXCLUSION_PATTERNS.travelConference.travel.test(label) &&
    EXCLUSION_PATTERNS.travelConference.conference.test(label)
  );
}

/**
 * Check if a label should be excluded based on all exclusion patterns
 */
export function shouldExcludeItem(
  label: string,
  expenseSectionHeader?: string
): boolean {
  if (isE17PayrollExpenses(label)) return true;
  if (shouldExcludeFromExpenseC(label, expenseSectionHeader)) return true;
  if (shouldExcludeFromExpenseE(label, expenseSectionHeader)) return true;
  return false;
}

/**
 * Check if a section is a Payroll/Wages section
 */
export function isPayrollSection(
  headerLabel: string,
  expenseSectionHeader?: string
): boolean {
  const upperHeader = headerLabel.toUpperCase();
  const upperExpenseHeader = expenseSectionHeader?.toUpperCase() || '';
  return (
    upperExpenseHeader.includes('PAYROLL') ||
    upperHeader.includes('PAYROLL') ||
    upperHeader.includes('WAGES') ||
    upperHeader.includes('WAGE')
  );
}

/**
 * Check if a label contains Clover or Courier keyword
 */
export function containsKeyword(label: string): { hasClover: boolean; hasCourier: boolean } {
  const upperLabel = label.toUpperCase();
  return {
    hasClover: upperLabel.includes(INCOME_KEYWORDS.clover),
    hasCourier: upperLabel.includes(INCOME_KEYWORDS.courier),
  };
}

/**
 * Recursively search for Clover or Courier keywords in nested rows
 */
export function searchForKeywords(rows: any[]): { foundClover: boolean; foundCourier: boolean } {
  let foundClover = false;
  let foundCourier = false;

  if (!Array.isArray(rows)) return { foundClover, foundCourier };

  for (const row of rows) {
    // Check Data rows
    if (row.ColData && Array.isArray(row.ColData) && row.type === 'Data') {
      const label = row.ColData[0]?.value || '';
      const keywords = containsKeyword(label);
      if (keywords.hasClover) foundClover = true;
      if (keywords.hasCourier) foundCourier = true;
      if (foundClover && foundCourier) break;
    }

    // Check Header rows
    if (row.Header?.ColData) {
      const headerLabel = row.Header.ColData[0]?.value || '';
      const keywords = containsKeyword(headerLabel);
      if (keywords.hasClover) foundClover = true;
      if (keywords.hasCourier) foundCourier = true;
      if (foundClover && foundCourier) break;
    }

    // Recursively search nested rows
    if (row.Rows?.Row && Array.isArray(row.Rows.Row)) {
      const nestedResult = searchForKeywords(row.Rows.Row);
      if (nestedResult.foundClover) foundClover = true;
      if (nestedResult.foundCourier) foundCourier = true;
      if (foundClover && foundCourier) break;
    }
  }

  return { foundClover, foundCourier };
}
