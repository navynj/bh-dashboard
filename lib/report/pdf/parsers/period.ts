import type {
  ReportData,
  SectionData,
  ExpenseSection,
  QuickBooksRow,
  TransformContext,
} from '../types';
import { transformItems } from './transformers/period';
import {
  identifySectionType,
  shouldExcludeExpenseSection,
  extractRowData,
  extractExpenseRowData,
  isExpenseSubSection,
  isTotalExpenses,
  extractPeriodSummaryValue,
  extractPeriodExpenseSummaryValue,
  SectionType,
} from './base';

/**
 * Create transform context for period mode
 */
function createTransformContext(
  expenseSectionHeader?: string,
  indentLevel: number = 0,
  isIncomeSection: boolean = false,
): TransformContext {
  return {
    expenseSectionHeader,
    indentLevel,
    isIncomeSection,
    keywordsFound: {
      foundClover: false,
      foundCourier: false,
    },
  };
}

/**
 * Parse report data into structured sections for period mode
 */
export function parseReportData(reportData: ReportData): {
  income: SectionData | null;
  costOfSales: SectionData | null;
  grossProfit: { label: string; value: string } | null;
  expenses: {
    sections: ExpenseSection[];
    total: { label: string; value: string } | null;
  };
  otherIncome: SectionData | null;
  profit: { label: string; value: string } | null;
} {
  const rows = reportData.Rows?.Row || [];

  let income: SectionData | null = null;
  let costOfSales: SectionData | null = null;
  let grossProfit: { label: string; value: string } | null = null;
  const expenseSections: ExpenseSection[] = [];
  let expensesTotal: { label: string; value: string } | null = null;
  let otherIncome: SectionData | null = null;
  let profit: { label: string; value: string } | null = null;

  rows.forEach((row) => {
    const { headerValue, summary, summaryLabel } = extractRowData(row);
    const summaryValue = extractPeriodSummaryValue(summary);
    const sectionType = identifySectionType(row);

    // INCOME section
    if (sectionType === SectionType.INCOME) {
      const context = createTransformContext(undefined, 0, true);
      const items = transformItems(
        (row.Rows?.Row || []) as QuickBooksRow[],
        context,
      );
      income = {
        header: 'Income',
        items,
        total: { label: summaryLabel, value: summaryValue },
      };
    }

    // COST OF GOODS SOLD / COST OF SALES section
    if (sectionType === SectionType.COST_OF_SALES) {
      const context = createTransformContext();
      const items = transformItems(
        (row.Rows?.Row || []) as QuickBooksRow[],
        context,
      );
      costOfSales = {
        header: 'Cost of Sales',
        items,
        total: { label: summaryLabel, value: summaryValue },
        isImportant: true,
      };
    }

    // Gross Profit (usually appears as a summary between COGS and Expenses)
    if (sectionType === SectionType.GROSS_PROFIT) {
      grossProfit = { label: summaryLabel, value: summaryValue };
    }

    // EXPENSES section
    if (sectionType === SectionType.EXPENSES) {
      // Process expense sub-sections (Expense A, B, C, D, E)
      const expenseRows = row.Rows?.Row || [];

      expenseRows.forEach((expenseRow: any) => {
        const { expenseHeader, expenseSummary, expenseSummaryLabel } =
          extractExpenseRowData(expenseRow);
        const expenseSummaryValue =
          extractPeriodExpenseSummaryValue(expenseSummary);

        // Check if this is an expense sub-section (Expense A, B, C, D, E)
        if (isExpenseSubSection(expenseRow)) {
          // Exclude E17 Payroll Expenses section entirely
          if (shouldExcludeExpenseSection(expenseHeader)) {
            return;
          }

          const context = createTransformContext(expenseHeader);
          const items = transformItems(
            expenseRow.Rows.Row as QuickBooksRow[],
            context,
          );
          expenseSections.push({
            header: expenseHeader,
            items,
            total: {
              label: expenseSummaryLabel,
              value: expenseSummaryValue,
            },
          });
        }
      });

      // Total for Expenses
      if (isTotalExpenses(summaryLabel)) {
        expensesTotal = { label: summaryLabel, value: summaryValue };
      }
    }

    // OTHER INCOME section
    if (sectionType === SectionType.OTHER_INCOME) {
      const context = createTransformContext();
      const items = transformItems(
        (row.Rows?.Row || []) as QuickBooksRow[],
        context,
      );
      otherIncome = {
        header: 'Other Income',
        items,
        total: { label: summaryLabel, value: summaryValue },
      };
    }

    // PROFIT
    if (sectionType === SectionType.PROFIT) {
      profit = { label: summaryLabel, value: summaryValue };
    }
  });

  return {
    income,
    costOfSales,
    grossProfit,
    expenses: {
      sections: expenseSections,
      total: expensesTotal,
    },
    otherIncome,
    profit,
  };
}
