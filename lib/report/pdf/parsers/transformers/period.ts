/**
 * Period Mode Item Transformation Logic
 * 
 * This file contains the logic for transforming QuickBooks report rows into items for period mode.
 * Follows Single Responsibility Principle - each function handles one specific case.
 */

import type {
  QuickBooksRow,
  PeriodItem,
  TransformContext,
} from '../../types';
import {
  getPreferredValue,
  getHeaderLabel,
  getSummaryLabel,
  isValidValue,
  hasHeaderValue,
  getHeaderValue,
  getDataRowLabel,
  getDataRowValue,
  shouldExcludeItem,
  containsKeyword,
  searchForKeywords,
  isDataRow,
  isHeaderRow,
} from '../../utils';
import {
  transformHeaderRowItemsBase,
  transformItemsBase,
  updateKeywordsFound,
  calculateIndent,
  createNestedContext,
  processDataRowLabel,
  type BaseTransformContext,
} from './base';

/**
 * Transform a single Data row into an item
 */
export function transformDataRowItem(
  row: QuickBooksRow,
  context: TransformContext,
): PeriodItem | null {
  if (!isDataRow(row)) return null;

  const label = getDataRowLabel(row);
  if (!label) return null;

  // Filter out excluded items and update keywords
  const { shouldExclude } = processDataRowLabel(label, context);
  if (shouldExclude) {
    return null;
  }

  const value = getDataRowValue(row);
  return {
    label,
    value,
    indent: calculateIndent(context.indentLevel),
  };
}

/**
 * Handle Payroll section transformation
 */
export function handlePayrollSection(
  row: QuickBooksRow,
  context: TransformContext,
): PeriodItem[] {
  const items: PeriodItem[] = [];
  const headerLabel = getHeaderLabel(row);

  // Always add the header first
  const preferred = getPreferredValue(row);
  let headerDisplayValue = preferred.value;

  // If header value is empty/0, try Summary
  if (!isValidValue(headerDisplayValue) && row.Summary?.ColData) {
    const summaryValue =
      row.Summary.ColData[row.Summary.ColData.length - 1]?.value || '';
    if (isValidValue(summaryValue)) {
      headerDisplayValue = summaryValue;
    }
  }

  // Always show header (use 0.00 if no value)
  if (!isValidValue(headerDisplayValue)) {
    headerDisplayValue = '0.00';
  }

  items.push({
    label: headerLabel,
    value: headerDisplayValue,
    indent: calculateIndent(context.indentLevel),
  });

  // Add nested items with indentation
  if (row.Rows?.Row && Array.isArray(row.Rows.Row)) {
    const nestedContext = createNestedContext(context);
    const nestedItems = transformItems(row.Rows.Row, nestedContext);
    items.push(...nestedItems);
  }

  return items;
}

/**
 * Handle Income section header with keywords in header itself
 */
export function handleIncomeHeaderWithKeywords(
  row: QuickBooksRow,
  context: TransformContext,
): PeriodItem[] {
  const headerLabel = getHeaderLabel(row);
  const headerKeywords = containsKeyword(headerLabel);

  if (!headerKeywords.hasClover && !headerKeywords.hasCourier) {
    return [];
  }

  // Update keywords found state
  updateKeywordsFound(headerKeywords, context);

  // Show header only (no nested items)
  const preferred = getPreferredValue(row);
  if (isValidValue(preferred.value)) {
    return [
      {
        label: headerLabel,
        value: preferred.value,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  return [];
}

/**
 * Handle Income section header with keywords in nested rows
 */
export function handleIncomeHeaderWithNestedKeywords(
  row: QuickBooksRow,
  context: TransformContext,
): PeriodItem[] {
  const items: PeriodItem[] = [];
  const headerLabel = getHeaderLabel(row);

  if (!row.Rows?.Row) return [];

  const nestedKeywords = searchForKeywords(row.Rows.Row);
  updateKeywordsFound(nestedKeywords, context);

  if (!nestedKeywords.foundClover && !nestedKeywords.foundCourier) {
    return [];
  }

  // Show header with Summary value if available
  const preferred = getPreferredValue(row);
  if (isValidValue(preferred.value)) {
    items.push({
      label: headerLabel,
      value: preferred.value,
      indent: calculateIndent(context.indentLevel),
    });

    // Process nested items with indentation
    const nestedContext = createNestedContext(context);
    const nestedItems = transformItems(row.Rows.Row, nestedContext);
    items.push(...nestedItems);
  } else if (hasHeaderValue(row)) {
    // Fallback to header value
    const headerValue = getHeaderValue(row);
    if (isValidValue(headerValue)) {
      items.push({
        label: headerLabel,
        value: headerValue,
        indent: calculateIndent(context.indentLevel),
      });
    }

    // Always add nested items
    const nestedContext = createNestedContext(context);
    const nestedItems = transformItems(row.Rows.Row, nestedContext);
    items.push(...nestedItems);
  }

  return items;
}

/**
 * Handle Income section header without keywords
 */
export function handleIncomeHeaderWithoutKeywords(
  row: QuickBooksRow,
  context: TransformContext,
): PeriodItem[] {
  const headerLabel = getHeaderLabel(row);
  const preferred = getPreferredValue(row);

  if (isValidValue(preferred.value)) {
    return [
      {
        label: headerLabel,
        value: preferred.value,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  // Fallback to Summary label if Header label is empty
  const summaryLabel = getSummaryLabel(row);
  if (summaryLabel && isValidValue(preferred.value)) {
    return [
      {
        label: summaryLabel,
        value: preferred.value,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  return [];
}

/**
 * Handle regular (non-Income) section header
 */
export function handleRegularSectionHeader(
  row: QuickBooksRow,
  context: TransformContext,
): PeriodItem[] {
  const headerLabel = getHeaderLabel(row);
  const preferred = getPreferredValue(row);

  if (headerLabel && isValidValue(preferred.value)) {
    return [
      {
        label: headerLabel,
        value: preferred.value,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  // Fallback to Summary label
  const summaryLabel = getSummaryLabel(row);
  if (summaryLabel && isValidValue(preferred.value)) {
    // Filter summary labels
    if (shouldExcludeItem(summaryLabel, context.expenseSectionHeader)) {
      return [];
    }

    return [
      {
        label: summaryLabel,
        value: preferred.value,
        indent: calculateIndent(context.indentLevel),
      },
    ];
  }

  // Fallback to header value
  if (hasHeaderValue(row)) {
    const headerValue = getHeaderValue(row);
    if (isValidValue(headerValue)) {
      return [
        {
          label: headerLabel,
          value: headerValue,
          indent: calculateIndent(context.indentLevel),
        },
      ];
    }
  }

  return [];
}

/**
 * Transform items from a Header row
 */
export function transformHeaderRowItems(
  row: QuickBooksRow,
  context: TransformContext,
): PeriodItem[] {
  return transformHeaderRowItemsBase<PeriodItem>(row, context, {
    handlePayroll: handlePayrollSection,
    handleIncomeWithKeywords: handleIncomeHeaderWithKeywords,
    handleIncomeWithNestedKeywords: handleIncomeHeaderWithNestedKeywords,
    handleIncomeWithoutKeywords: handleIncomeHeaderWithoutKeywords,
    handleRegularSection: handleRegularSectionHeader,
  });
}

/**
 * Transform items from a row structure for period mode reports
 * Main entry point - delegates to specific handlers
 */
export function transformItems(
  rows: QuickBooksRow[],
  context: TransformContext,
): PeriodItem[] {
  return transformItemsBase(
    rows,
    context,
    transformDataRowItem,
    transformHeaderRowItems,
  );
}
