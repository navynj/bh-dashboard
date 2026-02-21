import { jsPDF } from 'jspdf';
import { getTargetPercentagesWithDefaults } from '@/lib/report/targetPercentages';
import { MONTHLY_MODE_CONSTANTS, PERIOD_MODE_CONSTANTS } from './constants';
import { BaseRenderer, type RenderConfig } from './renderers/BaseRenderer';
import { MonthlyModeRenderer } from './renderers/MonthlyModeRenderer';
import { PeriodModeRenderer } from './renderers/PeriodModeRenderer';
import { parseReportData, parseReportDataMonthly } from './parsers';
import { extractMonthsFromReportData, isMonthlyMode } from './utils';
import type {
  MonthlyReportData,
  PeriodReportData,
  ReportData,
} from './types';

// ============================================================================
// PDF GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate PDF from report data (main entry point)
 */
export function generatePDFFromReportData(
  reportData: ReportData,
  startDate: string,
  endDate: string,
  locationName?: string | null,
  targetPercentages?: {
    costOfSales?: number;
    payroll?: number;
    profit?: number;
  },
): Uint8Array {
  // Apply defaults so COS, Payroll, Profit targets always print (e.g. when Notion has no values)
  const resolvedTargets = getTargetPercentagesWithDefaults(targetPercentages);

  const doc = new jsPDF();

  // Set up page
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PERIOD_MODE_CONSTANTS.margin;
  let yPosition: number = margin;

  // Header information
  const header = reportData.Header || {};
  const currency = header.Currency || 'CAD';

  // Extract months and determine mode
  const months = extractMonthsFromReportData(reportData);
  const monthlyMode = isMonthlyMode(reportData) || months.length > 0;

  // Render PDF header
  const title = monthlyMode ? 'Monthly P&L Report' : 'Profit & Loss Report';
  yPosition = BaseRenderer.renderHeader({
    doc,
    title,
    locationName,
      startDate,
      endDate,
    reportBasis: header.ReportBasis,
    pageWidth,
    margin,
    initialYPosition: yPosition,
  });

  // Create renderer configuration
  const renderConfig: RenderConfig = {
    pageWidth,
    pageHeight,
    margin: monthlyMode
      ? MONTHLY_MODE_CONSTANTS.margin
      : PERIOD_MODE_CONSTANTS.margin,
    currency,
  };

  // Create PDF renderer
  const pdfRenderer = new BaseRenderer(doc, renderConfig, yPosition);

  // Determine rendering strategy based on mode
  if (monthlyMode && months.length > 0) {
    // Monthly mode rendering
    const parsed = parseReportDataMonthly(reportData, months.length);
    const strategy = new MonthlyModeRenderer(months);
    strategy.render(
      pdfRenderer,
      parsed as MonthlyReportData,
      resolvedTargets,
    );
  } else {
    // Period mode rendering
    const parsed = parseReportData(reportData);
    const strategy = new PeriodModeRenderer();
    strategy.render(pdfRenderer, parsed as PeriodReportData, resolvedTargets);
  }

  // Return PDF as Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Convert PDF Uint8Array to base64 string
 */
export function pdfToBase64(pdfBytes: Uint8Array): string {
  const binary = String.fromCharCode(...pdfBytes);
  return Buffer.from(binary, 'binary').toString('base64');
}
