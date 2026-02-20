/**
 * PDF Generator Constants
 * 
 * This file contains all constants used for PDF generation,
 * including layout constants for period and monthly modes,
 * exclusion patterns, and keywords.
 */

/**
 * PDF layout constants for period mode
 */
export const PERIOD_MODE_CONSTANTS = {
  margin: 20,
  titleFontSize: 16,
  locationFontSize: 12,
  periodFontSize: 11,
  basisFontSize: 10,
  sectionHeaderFontSize: { normal: 12, important: 13 },
  columnHeaderFontSize: 9,
  itemFontSize: 10,
  totalFontSize: { normal: 11, important: 12 },
  profitFontSize: 14,
  targetFontSize: { normal: 9, profit: 11 },
  lineHeight: 7,
  lineSpacing: 5,
  sectionSpacing: 8,
  labelWidthRatio: 0.7,
  valueWidthRatio: 0.2,
  percentageWidthRatio: 0.1,
  textPaddingMultiplier: 2,
  boldTextPaddingMultiplier: 3.5,
  lineWidth: { header: 0.5, columnHeader: 0.3, row: 0.1, expenseSection: 0.2 },
  indentPerLevel: 10,
} as const;

/**
 * PDF layout constants for monthly mode
 */
export const MONTHLY_MODE_CONSTANTS = {
  margin: 12,
  sectionHeaderFontSize: { normal: 10, important: 11 },
  columnHeaderFontSize: 7,
  subHeaderFontSize: 6,
  itemFontSize: 8,
  totalFontSize: { normal: 9, important: 10 },
  profitFontSize: 9,
  targetFontSize: 8,
  lineHeight: 6,
  lineSpacing: 4,
  sectionSpacing: 6,
  labelWidthRatio: { singleMonth: 0.8, fewColumns: 0.4, manyColumns: 0.35, manyColumnsAlt: 0.3 },
  columnWidthCalculation: 0.5,
  textPaddingMultiplier: { singleMonth: 1.5, multiMonth: 3 },
  boldTextPaddingMultiplier: { singleMonth: 1.5, multiMonth: 2.5 },
  lineWidth: { header: 0.3, row: 0.1, expenseSection: 0.2 },
  indentPerLevel: 8,
  columnMargin: 3,
  minTextWidth: 15,
  safetyMarginRatio: { singleMonth: 0.95, multiMonth: 0.8 },
} as const;

/**
 * Exclusion patterns for PDF generation only.
 * Used as case-insensitive regex to match QuickBooks label variations.
 */
export const EXCLUSION_PATTERNS = {
  /** Match E17 Payroll Expenses (exact or with minor variation) */
  e17PayrollExpenses: /E17\s*[-–]?\s*PAYROLL\s+EXPENSES/i,
  /** Match Online Subscription */
  onlineSubscription: /ONLINE\s+SUBSCRIPTION/i,
  /** Match Travel and Conference (both required for Expense E exclusion) */
  travelConference: { travel: /TRAVEL/i, conference: /CONFERENCE/i },
  /** Match Expense C section header */
  expenseC: /EXPENSE\s+C\b/i,
  /** Match Expense E section header */
  expenseE: /EXPENSE\s+E\b/i,
} as const;

/**
 * Keywords for income section filtering
 */
export const INCOME_KEYWORDS = {
  clover: 'CLOVER',
  courier: 'COURIER',
} as const;
