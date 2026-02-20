/**
 * Monthly Mode Item Transformation Logic
 * 
 * This file contains the logic for transforming QuickBooks report rows into items for monthly mode.
 * Follows Single Responsibility Principle - each function handles one specific case.
 */

import type {
  QuickBooksRow,
  MonthlyItem,
  MonthlyTransformContext,
} from '../../types';
import {
  getMonthlyValues,
  hasHeaderMonthlyValue,
  isValidValue,
  getDataRowLabel,
  getHeaderLabel,
  getSummaryLabel,
  shouldExcludeItem,
  containsKeyword,
  searchForKeywords,
  isDataRow,
} from '../../utils';
import {
  transformHeaderRowItemsBase,
  transformItemsBase,
  updateKeywordsFound,
  calculateIndent,
  createNestedContext,
  processDataRowLabel,
} from './base';

/**
 * Transform a single Data row into a monthly item
 */
export function transformMonthlyDataRowItem(
  row: QuickBooksRow,
  context: MonthlyTransformContext,
): MonthlyItem | null {
  if (!isDataRow(row) || !row.ColData) return null;

  const label = getDataRowLabel(row);
  if (!label) return null;

  // Filter out excluded items and update keywords
  const { shouldExclude } = processDataRowLabel(label, context);
  if (shouldExclude) {
    return null;
  }

  const values = row.ColData.slice(1, context.numMonths + 1).map(
    (col) => col?.value || '0',
  );
  const total = row.ColData[row.ColData.length - 1]?.value || '0';

  return {
    label,
    values,
    total,
    indent: calculateIndent(context.indentLevel),
  };
}

/**
 * Handle Payroll section transformation for monthly mode
 */
export function handleMonthlyPayrollSection(
  row: QuickBooksRow,
  context: MonthlyTransformContext,
): MonthlyItem[] {
  const items: MonthlyItem[] = [];
  const headerLabel = getHeaderLabel(row);

  // Always add the header first
  const { values, total } = getMonthlyValues(row, context.numMonths);
  let headerDisplayValues = values;
  let headerDisplayTotal = total;

  // If header value is empty/0, try Summary
  if (
    !hasHeaderMonthlyValue(row, context.numMonths) &&
    row.Summary?.ColData
  ) {
    const summaryValues = getMonthlyValues(row, context.numMonths);
    if (isValidValue(summaryValues.total)) {
      headerDisplayValues = summaryValues.values;
      headerDisplayTotal = summaryValues.total;
    }
  }

  // Always show header (use 0.00 if no value)
  if (!isValidValue(headerDisplayTotal)) {
    headerDisplayTotal = '0.00';
    headerDisplayValues = Array(context.numMonths).fill('0');
  }

  items.push({
    label: headerLabel,
    values: headerDisplayValues,
    total: headerDisplayTotal,
    indent: calculateIndent(context.indentLevel),
  });

  // Add nested items with indentation
  if (row.Rows?.Row && Array.isArray(row.Rows.Row)) {
    const nestedContext = createNestedContext(context);
    const nestedItems = transformMonthlyItems(row.Rows.Row, nestedContext);
    items.push(...nestedItems);
  }

  return items;
}

/**
 * Handle Income section header with keywords in header itself (monthly mode)
 */
export function handleMonthlyIncomeHeaderWithKeywords(
  row: QuickBooksRow,
  context: MonthlyTransformContext,
): MonthlyItem[] {
  const headerLabel = getHeaderLabel(row);
  const headerKeywords = containsKeyword(headerLabel);

  if (!headerKeywords.hasClover && !headerKeywords.hasCourier) {
    return [];
  }

  // Update keywords found state
  updateKeywordsFound(headerKeywords, context);

  // Show header only (no nested items)
  const { values, total } = getMonthlyValues(row, context.numMonths);
  if (isValidValue(total)) {
    return [
      {
        label: headerLabel,
        values,
        total,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  return [];
}

/**
 * Handle Income section header with keywords in nested rows (monthly mode)
 */
export function handleMonthlyIncomeHeaderWithNestedKeywords(
  row: QuickBooksRow,
  context: MonthlyTransformContext,
): MonthlyItem[] {
  const items: MonthlyItem[] = [];
  const headerLabel = getHeaderLabel(row);

  if (!row.Rows?.Row) return [];

  const nestedKeywords = searchForKeywords(row.Rows.Row);
  updateKeywordsFound(nestedKeywords, context);

  if (!nestedKeywords.foundClover && !nestedKeywords.foundCourier) {
    return [];
  }

  // Show header with Summary value if available
  const { values, total } = getMonthlyValues(row, context.numMonths);
  if (isValidValue(total)) {
    items.push({
      label: headerLabel,
      values,
      total,
      indent: calculateIndent(context.indentLevel),
    });

    // Process nested items with indentation
    const nestedContext = createNestedContext(context);
    const nestedItems = transformMonthlyItems(row.Rows.Row, nestedContext);
    items.push(...nestedItems);
  } else if (hasHeaderMonthlyValue(row, context.numMonths)) {
    // Fallback to header value
    const headerValues = getMonthlyValues(row, context.numMonths);
    if (isValidValue(headerValues.total)) {
      items.push({
        label: headerLabel,
        values: headerValues.values,
        total: headerValues.total,
        indent: calculateIndent(context.indentLevel),
      });
    }

    // Always add nested items
    const nestedContext = createNestedContext(context);
    const nestedItems = transformMonthlyItems(row.Rows.Row, nestedContext);
    items.push(...nestedItems);
  }

  return items;
}

/**
 * Handle Income section header without keywords (monthly mode)
 */
export function handleMonthlyIncomeHeaderWithoutKeywords(
  row: QuickBooksRow,
  context: MonthlyTransformContext,
): MonthlyItem[] {
  const headerLabel = getHeaderLabel(row);
  const { values, total } = getMonthlyValues(row, context.numMonths);

  if (headerLabel && isValidValue(total)) {
    return [
      {
        label: headerLabel,
        values,
        total,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  // Fallback to Summary label
  const summaryLabel = getSummaryLabel(row);
  if (summaryLabel && isValidValue(total)) {
    return [
      {
        label: summaryLabel,
        values,
        total,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  return [];
}

/**
 * Handle regular (non-Income) section header (monthly mode)
 */
export function handleMonthlyRegularSectionHeader(
  row: QuickBooksRow,
  context: MonthlyTransformContext,
): MonthlyItem[] {
  const headerLabel = getHeaderLabel(row);
  const { values, total } = getMonthlyValues(row, context.numMonths);

  if (headerLabel && isValidValue(total)) {
    return [
      {
        label: headerLabel,
        values,
        total,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  // Fallback to Summary label
  const summaryLabel = getSummaryLabel(row);
  if (summaryLabel && isValidValue(total)) {
    // Filter summary labels
    if (shouldExcludeItem(summaryLabel, context.expenseSectionHeader)) {
      return [];
    }

    return [
      {
        label: summaryLabel,
        values,
        total,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  // Fallback to header value
  if (hasHeaderMonthlyValue(row, context.numMonths)) {
    const headerValues = getMonthlyValues(row, context.numMonths);
    if (isValidValue(headerValues.total)) {
      return [
        {
          label: headerLabel,
          values: headerValues.values,
          total: headerValues.total,
          indent: calculateIndent(context.indentLevel),
        },
      ];
    }
  }

  return [];
}

/**
 * Transform items from a Header row (monthly mode)
 */
export function transformMonthlyHeaderRowItems(
  row: QuickBooksRow,
  context: MonthlyTransformContext,
): MonthlyItem[] {
  return transformHeaderRowItemsBase<MonthlyItem, MonthlyTransformContext>(row, context, {
    handlePayroll: handleMonthlyPayrollSection,
    handleIncomeWithKeywords: handleMonthlyIncomeHeaderWithKeywords,
    handleIncomeWithNestedKeywords: handleMonthlyIncomeHeaderWithNestedKeywords,
    handleIncomeWithoutKeywords: handleMonthlyIncomeHeaderWithoutKeywords,
    handleRegularSection: handleMonthlyRegularSectionHeader,
  });
}

/**
 * Transform items from a row structure for monthly mode reports
 * Main entry point - delegates to specific handlers
 */
export function transformMonthlyItems(
  rows: QuickBooksRow[],
  context: MonthlyTransformContext,
): MonthlyItem[] {
  return transformItemsBase(
    rows,
    context,
    transformMonthlyDataRowItem,
    transformMonthlyHeaderRowItems,
  );
}
