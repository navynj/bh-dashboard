/**
 * PDF Generator Type Definitions
 * 
 * This file contains all TypeScript interfaces and types
 * used for PDF generation.
 */

/**
 * QuickBooks API Column Data structure
 */
export interface QuickBooksColData {
  value?: string;
}

/**
 * QuickBooks API Row structure
 */
export interface QuickBooksRow {
  type?: 'Data' | 'Header' | 'Section';
  ColData?: QuickBooksColData[];
  Header?: {
    ColData?: QuickBooksColData[];
  };
  Summary?: {
    ColData?: QuickBooksColData[];
  };
  Rows?: {
    Row?: QuickBooksRow[];
  };
  group?: string;
}

/**
 * QuickBooks API Column structure
 */
export interface QuickBooksColumn {
  ColTitle?: string;
  MetaData?: Array<{
    Name?: string;
    Value?: string;
  }>;
}

/**
 * Main report data structure from QuickBooks API
 */
export interface ReportData {
  Header?: {
    ReportBasis?: string;
    Currency?: string;
    StartPeriod?: string;
    EndPeriod?: string;
    SummarizeColumnsBy?: string;
    Option?: Array<{
      Name?: string;
      Value?: string;
    }>;
  };
  Rows?: {
    Row?: QuickBooksRow[];
  };
  Columns?: {
    Column?: QuickBooksColumn[];
  };
}

/**
 * Section data structure for period mode
 */
export interface SectionData {
  header: string;
  items: Array<{ label: string; value: string; indent?: number }>;
  total: { label: string; value: string };
  isImportant?: boolean;
}

/**
 * Expense section data structure for period mode
 */
export interface ExpenseSection {
  header: string;
  items: Array<{ label: string; value: string; indent?: number }>;
  total: { label: string; value: string };
}

/**
 * Section data structure for monthly mode
 */
export interface MonthlySectionData {
  header: string;
  items: Array<{
    label: string;
    values: string[];
    total: string;
    indent?: number;
  }>;
  total: { label: string; values: string[]; total: string } | null;
  isImportant?: boolean;
}

/**
 * Expense section data structure for monthly mode
 */
export interface MonthlyExpenseSection {
  header: string;
  items: Array<{
    label: string;
    values: string[];
    total: string;
    indent?: number;
  }>;
  total: { label: string; values: string[]; total: string } | null;
}

/**
 * Item structure for period mode
 */
export interface PeriodItem {
  label: string;
  value: string;
  indent?: number;
}

/**
 * Item structure for monthly mode
 */
export interface MonthlyItem {
  label: string;
  values: string[];
  total: string;
  indent?: number;
}

/**
 * Keywords found state for income section processing
 */
export interface KeywordsFound {
  foundClover: boolean;
  foundCourier: boolean;
}

/**
 * Context for transforming items from report data
 */
export interface TransformContext {
  expenseSectionHeader?: string;
  indentLevel: number;
  isIncomeSection: boolean;
  keywordsFound: KeywordsFound;
}

/**
 * Context for transforming monthly items
 */
export interface MonthlyTransformContext extends TransformContext {
  numMonths: number;
}

/**
 * Value source indicator
 */
export type ValueSource = 'summary' | 'header' | 'default';

/**
 * Extracted value with source information
 */
export interface ExtractedValue {
  value: string;
  source: ValueSource;
}

/**
 * Target percentages for different sections
 */
export interface TargetPercentages {
  costOfSales?: number;
  payroll?: number;
  profit?: number;
}

/**
 * Parsed report data for period mode
 */
export interface PeriodReportData {
  income: SectionData | null;
  costOfSales: SectionData | null;
  grossProfit: { label: string; value: string } | null;
  expenses: {
    sections: ExpenseSection[];
    total: { label: string; value: string } | null;
  };
  otherIncome: SectionData | null;
  profit: { label: string; value: string } | null;
}

/**
 * Parsed report data for monthly mode
 */
export interface MonthlyReportData {
  income: MonthlySectionData | null;
  costOfSales: MonthlySectionData | null;
  grossProfit: { label: string; values: string[]; total: string } | null;
  expenses: {
    sections: MonthlyExpenseSection[];
    total: { label: string; values: string[]; total: string } | null;
  };
  otherIncome: MonthlySectionData | null;
  profit: { label: string; values: string[]; total: string } | null;
}

/**
 * PDF Rendering Strategy Interface
 * 
 * Defines the interface for different PDF rendering strategies (Period vs Monthly).
 * Follows Strategy Pattern and Dependency Inversion Principle.
 * 
 * Note: BaseRenderer is imported as a type to avoid circular dependencies.
 */
export interface RenderStrategy {
  /**
   * Render the complete PDF report
   */
  render(
    renderer: import('./renderers/BaseRenderer').BaseRenderer,
    parsedData: PeriodReportData | MonthlyReportData,
    targetPercentages?: TargetPercentages,
  ): void;
}
