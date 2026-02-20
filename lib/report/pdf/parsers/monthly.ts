import type {
  ReportData,
  MonthlySectionData,
  MonthlyExpenseSection,
  QuickBooksRow,
  MonthlyTransformContext,
} from '../types';
import { transformMonthlyItems } from './transformers/monthly';
import {
  identifySectionType,
  shouldExcludeExpenseSection,
  extractRowData,
  extractExpenseRowData,
  isExpenseSubSection,
  isTotalExpenses,
  extractMonthlySummaryValues,
  extractMonthlyExpenseSummaryValues,
  createMonthlyTransformContext,
  SectionType,
} from './base';

/**
 * Parse report data for monthly mode
 */
export function parseReportDataMonthly(
  reportData: ReportData,
  numMonths: number,
): {
  income: MonthlySectionData | null;
  costOfSales: MonthlySectionData | null;
  grossProfit: { label: string; values: string[]; total: string } | null;
  expenses: {
    sections: MonthlyExpenseSection[];
    total: { label: string; values: string[]; total: string } | null;
  };
  otherIncome: MonthlySectionData | null;
  profit: { label: string; values: string[]; total: string } | null;
} {
  const rows = reportData.Rows?.Row || [];

  let income: MonthlySectionData | null = null;
  let costOfSales: MonthlySectionData | null = null;
  let grossProfit: { label: string; values: string[]; total: string } | null =
    null;
  const expenseSections: MonthlyExpenseSection[] = [];
  let expensesTotal: { label: string; values: string[]; total: string } | null =
    null;
  let otherIncome: MonthlySectionData | null = null;
  let profit: { label: string; values: string[]; total: string } | null = null;

  rows.forEach((row) => {
    const { summary, summaryLabel } = extractRowData(row);
    // Summary ColData structure: [label, month1, month2, ..., monthN, total]
    const { values: summaryValues, total: summaryTotal } =
      extractMonthlySummaryValues(summary, numMonths);

    const sectionType = identifySectionType(row);

    // INCOME section
    if (sectionType === SectionType.INCOME) {
      const context = createMonthlyTransformContext(numMonths, undefined, 0, true);
      const items = transformMonthlyItems(
        (row.Rows?.Row || []) as QuickBooksRow[],
        context,
      );
      income = {
        header: 'Income',
        items,
        total: summaryLabel
          ? { label: summaryLabel, values: summaryValues, total: summaryTotal }
          : null,
      };
    }

    // COST OF GOODS SOLD / COST OF SALES section
    if (sectionType === SectionType.COST_OF_SALES) {
      const context = createMonthlyTransformContext(numMonths);
      const items = transformMonthlyItems(
        (row.Rows?.Row || []) as QuickBooksRow[],
        context,
      );
      costOfSales = {
        header: 'Cost of Sales',
        items,
        total: summaryLabel
          ? { label: summaryLabel, values: summaryValues, total: summaryTotal }
          : null,
        isImportant: true,
      };
    }

    // Gross Profit
    if (sectionType === SectionType.GROSS_PROFIT) {
      grossProfit = {
        label: summaryLabel,
        values: summaryValues,
        total: summaryTotal,
      };
    }

    // EXPENSES section
    if (sectionType === SectionType.EXPENSES) {
      const expenseRows = row.Rows?.Row || [];

      expenseRows.forEach((expenseRow: any) => {
        const { expenseHeader, expenseSummary, expenseSummaryLabel } =
          extractExpenseRowData(expenseRow);
        const { values: expenseSummaryValues, total: expenseSummaryTotal } =
          extractMonthlyExpenseSummaryValues(expenseSummary, numMonths);

        if (isExpenseSubSection(expenseRow)) {
          // Exclude E17 Payroll Expenses section entirely
          if (shouldExcludeExpenseSection(expenseHeader)) {
            return;
          }

          const context = createMonthlyTransformContext(numMonths, expenseHeader);
          const items = transformMonthlyItems(
            expenseRow.Rows.Row as QuickBooksRow[],
            context,
          );
          expenseSections.push({
            header: expenseHeader,
            items,
            total: expenseSummaryLabel
              ? {
                  label: expenseSummaryLabel,
                  values: expenseSummaryValues,
                  total: expenseSummaryTotal,
                }
              : null,
          });
        }
      });

      if (isTotalExpenses(summaryLabel)) {
        expensesTotal = {
          label: summaryLabel,
          values: summaryValues,
          total: summaryTotal,
        };
      }
    }

    // OTHER INCOME section
    if (sectionType === SectionType.OTHER_INCOME) {
      const context = createMonthlyTransformContext(numMonths);
      const items = transformMonthlyItems(
        (row.Rows?.Row || []) as QuickBooksRow[],
        context,
      );
      otherIncome = {
        header: 'Other Income',
        items,
        total: summaryLabel
          ? { label: summaryLabel, values: summaryValues, total: summaryTotal }
          : null,
      };
    }

    // PROFIT
    if (sectionType === SectionType.PROFIT) {
      profit = {
        label: summaryLabel,
        values: summaryValues,
        total: summaryTotal,
      };
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
