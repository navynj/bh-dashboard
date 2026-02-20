/**
 * Formatting Utilities
 * 
 * Provides formatting functions for PDF generation.
 */

/**
 * Format currency value with proper symbol and formatting
 */
export function formatCurrency(value: string, currency: string = 'CAD'): string {
  if (!value || value === '') return '';

  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;

  const symbol =
    currency === 'USD' ? '$' : currency === 'CAD' ? 'C$' : currency;
  // Preserve negative sign for values like Profit which can be negative
  const formattedValue = Math.abs(numValue).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Add negative sign if original value was negative
  return numValue < 0 ? `-${symbol}${formattedValue}` : `${symbol}${formattedValue}`;
}
