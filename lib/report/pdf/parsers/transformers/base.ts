/**
 * Base Transformation Logic
 * 
 * Common transformation logic shared between Period and Monthly modes.
 * Handles keyword detection, filtering, and header row processing.
 */

import type { QuickBooksRow } from '../../types';
import {
  getHeaderLabel,
  getSummaryLabel,
  isDataRow,
  isHeaderRow,
  getDataRowLabel,
} from '../../utils';
import { shouldExcludeItem, isPayrollSection, containsKeyword, searchForKeywords } from '../../utils';

/**
 * Common context interface for transformation
 */
export interface BaseTransformContext {
  expenseSectionHeader?: string;
  indentLevel: number;
  isIncomeSection: boolean;
  keywordsFound: {
    foundClover: boolean;
    foundCourier: boolean;
  };
}

/**
 * Transform header row items with common logic
 * Delegates value transformation to mode-specific functions
 */
export function transformHeaderRowItemsBase<
  TItem,
  TContext extends BaseTransformContext = BaseTransformContext,
>(
  row: QuickBooksRow,
  context: TContext,
  handlers: {
    handlePayroll: (row: QuickBooksRow, context: TContext) => TItem[];
    handleIncomeWithKeywords: (
      row: QuickBooksRow,
      context: TContext,
    ) => TItem[];
    handleIncomeWithNestedKeywords: (
      row: QuickBooksRow,
      context: TContext,
    ) => TItem[];
    handleIncomeWithoutKeywords: (
      row: QuickBooksRow,
      context: TContext,
    ) => TItem[];
    handleRegularSection: (row: QuickBooksRow, context: TContext) => TItem[];
  },
): TItem[] {
  const headerLabel = getHeaderLabel(row);

  // Filter out excluded sections
  if (shouldExcludeItem(headerLabel, context.expenseSectionHeader)) {
    return [];
  }

  // Check if this is a Payroll section
  const isPayroll = isPayrollSection(headerLabel, context.expenseSectionHeader);
  if (isPayroll && row.Rows?.Row && Array.isArray(row.Rows.Row)) {
    return handlers.handlePayroll(row, context);
  }

  // Special handling for Income section
  if (context.isIncomeSection) {
    // Check if both keywords are already found
    if (
      context.keywordsFound.foundClover &&
      context.keywordsFound.foundCourier
    ) {
      return handlers.handleIncomeWithoutKeywords(row, context);
    }

    // Check if header itself has keywords
    const headerKeywords = containsKeyword(headerLabel);
    if (headerKeywords.hasClover || headerKeywords.hasCourier) {
      return handlers.handleIncomeWithKeywords(row, context);
    }

    // Check nested rows for keywords
    if (row.Rows?.Row) {
      const nestedKeywords = searchForKeywords(row.Rows.Row);
      if (nestedKeywords.foundClover || nestedKeywords.foundCourier) {
        return handlers.handleIncomeWithNestedKeywords(row, context);
      }
    }

    // No keywords found
    return handlers.handleIncomeWithoutKeywords(row, context);
  }

  // Regular section handling
  return handlers.handleRegularSection(row, context);
}

/**
 * Transform items from rows with common logic
 */
export function transformItemsBase<
  TItem,
  TContext extends BaseTransformContext = BaseTransformContext,
>(
  rows: QuickBooksRow[],
  context: TContext,
  transformDataRow: (row: QuickBooksRow, context: TContext) => TItem | null,
  transformHeaderRow: (row: QuickBooksRow, context: TContext) => TItem[],
): TItem[] {
  const items: TItem[] = [];

  if (!Array.isArray(rows)) return items;

  for (const row of rows) {
    // Handle Data rows
    if (isDataRow(row)) {
      const item = transformDataRow(row, context);
      if (item) {
        items.push(item);
      }
      continue;
    }

    // Handle Header rows with nested rows
    if (isHeaderRow(row)) {
      const headerItems = transformHeaderRow(row, context);
      items.push(...headerItems);
      continue;
    }
  }

  return items;
}

/**
 * Update keywords found state from keyword check result
 * Supports both { hasClover, hasCourier } and { foundClover, foundCourier } formats
 */
export function updateKeywordsFound(
  keywords:
    | { hasClover: boolean; hasCourier: boolean }
    | { foundClover: boolean; foundCourier: boolean },
  context: BaseTransformContext,
): void {
  const hasClover =
    'hasClover' in keywords ? keywords.hasClover : keywords.foundClover;
  const hasCourier =
    'hasCourier' in keywords ? keywords.hasCourier : keywords.foundCourier;

  if (hasClover) context.keywordsFound.foundClover = true;
  if (hasCourier) context.keywordsFound.foundCourier = true;
}

/**
 * Calculate indent value from context
 */
export function calculateIndent(indentLevel: number): number | undefined {
  return indentLevel > 0 ? indentLevel : undefined;
}

/**
 * Create nested context with incremented indent level
 */
export function createNestedContext<T extends BaseTransformContext>(
  context: T,
): T {
  return {
    ...context,
    indentLevel: context.indentLevel + 1,
  };
}

/**
 * Check if label should be excluded and update keywords if in income section
 */
export function processDataRowLabel(
  label: string,
  context: BaseTransformContext,
): { shouldExclude: boolean } {
  // Filter out excluded items
  if (shouldExcludeItem(label, context.expenseSectionHeader)) {
    return { shouldExclude: true };
  }

  // For Income section, check for keywords
  if (context.isIncomeSection) {
    const keywords = containsKeyword(label);
    updateKeywordsFound(keywords, context);
  }

  return { shouldExclude: false };
}
