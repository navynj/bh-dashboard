/**
 * Row Utilities
 * 
 * Provides utilities for checking row types and extracting values from QuickBooks API responses.
 * Combines row type checking and value extraction functionality.
 */

import type { QuickBooksRow, ExtractedValue } from '../types';

/**
 * Check if a value is valid (non-empty and non-zero)
 */
export function isValidValue(value: string | undefined | null): boolean {
  if (!value) return false;
  return value !== '' && value !== '0' && value !== '0.00';
}

/**
 * Check if a row is a Data row
 */
export function isDataRow(row: QuickBooksRow): boolean {
  return (
    row.ColData !== undefined &&
    Array.isArray(row.ColData) &&
    (!row.type || row.type === 'Data')
  );
}

/**
 * Check if a row is a Header row with nested rows
 */
export function isHeaderRow(row: QuickBooksRow): boolean {
  return (
    row.Header?.ColData !== undefined &&
    row.Rows?.Row !== undefined &&
    Array.isArray(row.Rows.Row)
  );
}

/**
 * Extract label from a Data row
 */
export function getDataRowLabel(row: QuickBooksRow): string {
  return row.ColData?.[0]?.value || '';
}

/**
 * Extract value from a Data row
 */
export function getDataRowValue(row: QuickBooksRow): string {
  return row.ColData?.[1]?.value || '';
}

/**
 * Extract summary value from a row
 * Prefers the last column (total) if available, otherwise falls back to second column
 */
export function getSummaryValue(
  row: QuickBooksRow,
  preferLast: boolean = true,
): string {
  if (!row.Summary?.ColData || !Array.isArray(row.Summary.ColData)) {
    return '';
  }

  const colData = row.Summary.ColData;
  if (colData.length === 0) return '';

  if (preferLast && colData.length > 1) {
    return colData[colData.length - 1]?.value || colData[1]?.value || '';
  }

  return colData[1]?.value || '';
}

/**
 * Extract header value from a row
 */
export function getHeaderValue(row: QuickBooksRow): string {
  if (!row.Header?.ColData || !Array.isArray(row.Header.ColData)) {
    return '';
  }

  // Header ColData structure: [label, value1, value2, ..., valueN]
  // Return the first value after the label (index 1)
  return row.Header.ColData[1]?.value || '';
}

/**
 * Extract header label from a row
 */
export function getHeaderLabel(row: QuickBooksRow): string {
  return row.Header?.ColData?.[0]?.value || '';
}

/**
 * Extract summary label from a row
 */
export function getSummaryLabel(row: QuickBooksRow): string {
  return row.Summary?.ColData?.[0]?.value || '';
}

/**
 * Get preferred value from a row (Summary preferred over Header)
 * Returns value with source information
 */
export function getPreferredValue(
  row: QuickBooksRow,
  preferLast: boolean = true,
): ExtractedValue {
  const summaryValue = getSummaryValue(row, preferLast);
  if (isValidValue(summaryValue)) {
    return { value: summaryValue, source: 'summary' };
  }

  const headerValue = getHeaderValue(row);
  if (isValidValue(headerValue)) {
    return { value: headerValue, source: 'header' };
  }

  return { value: '0.00', source: 'default' };
}

/**
 * Extract month values from ColData array
 * ColData structure: [label, month1, month2, ..., monthN, total]
 */
export function getMonthValues(
  colData: Array<{ value?: string }>,
  numMonths: number,
): string[] {
  if (!colData || colData.length === 0) {
    return Array(numMonths).fill('0');
  }

  // Skip first (label) and last (total), get month values
  const monthValues = colData.slice(1, -1);
  if (monthValues.length >= numMonths) {
    return monthValues
      .slice(0, numMonths)
      .map((col) => col?.value || '0');
  }

  // Fallback: try to get numMonths values starting from index 1
  return colData
    .slice(1, numMonths + 1)
    .map((col) => col?.value || '0');
}

/**
 * Extract total value from ColData array (last element)
 */
export function getTotalValue(colData: Array<{ value?: string }>): string {
  if (!colData || colData.length === 0) return '0';
  return colData[colData.length - 1]?.value || '0';
}

/**
 * Extract month values and total from a row for monthly mode
 */
export function getMonthlyValues(
  row: QuickBooksRow,
  numMonths: number,
): { values: string[]; total: string } {
  // Try Summary first
  if (row.Summary?.ColData) {
    return {
      values: getMonthValues(row.Summary.ColData, numMonths),
      total: getTotalValue(row.Summary.ColData),
    };
  }

  // Fallback to Header
  if (row.Header?.ColData) {
    return {
      values: getMonthValues(row.Header.ColData, numMonths),
      total: getTotalValue(row.Header.ColData),
    };
  }

  // Fallback to ColData
  if (row.ColData) {
    return {
      values: getMonthValues(row.ColData, numMonths),
      total: getTotalValue(row.ColData),
    };
  }

  return {
    values: Array(numMonths).fill('0'),
    total: '0',
  };
}

/**
 * Check if header has any non-empty values
 */
export function hasHeaderValue(row: QuickBooksRow): boolean {
  if (!row.Header?.ColData || row.Header.ColData.length < 2) {
    return false;
  }

  // Check values after the label (index 1 onwards)
  const values = row.Header.ColData.slice(1);
  return values.some((col) => isValidValue(col?.value));
}

/**
 * Check if header has any non-empty values for monthly mode
 */
export function hasHeaderMonthlyValue(
  row: QuickBooksRow,
  numMonths: number,
): boolean {
  if (!row.Header?.ColData || row.Header.ColData.length < 2) {
    return false;
  }

  const monthValues = getMonthValues(row.Header.ColData, numMonths);
  const total = getTotalValue(row.Header.ColData);

  return (
    monthValues.some((val) => isValidValue(val)) ||
    isValidValue(total)
  );
}
