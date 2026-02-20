/**
 * Base PDF Renderer
 *
 * Provides common PDF rendering utilities, page management, and helper functions.
 * This is the foundation for all PDF rendering operations.
 */

import { jsPDF } from 'jspdf';
import { formatCurrency } from '../utils';
import { PERIOD_MODE_CONSTANTS, MONTHLY_MODE_CONSTANTS } from '../constants';

/**
 * Configuration for PDF rendering
 */
export interface RenderConfig {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  currency: string;
}

/**
 * Position tracking for PDF rendering
 */
export class PositionTracker {
  private _y: number;
  private readonly pageHeight: number;
  private readonly margin: number;

  constructor(initialY: number, pageHeight: number, margin: number) {
    this._y = initialY;
    this.pageHeight = pageHeight;
    this.margin = margin;
  }

  get y(): number {
    return this._y;
  }

  moveDown(amount: number): void {
    this._y += amount;
  }

  setY(y: number): void {
    this._y = y;
  }

  checkPageBreak(doc: jsPDF, requiredSpace: number): boolean {
    if (this._y + requiredSpace > this.pageHeight - this.margin) {
      doc.addPage();
      this._y = this.margin;
      return true;
    }
    return false;
  }
}

/**
 * Base PDF Renderer class
 * Provides common rendering utilities and helper functions
 */
export class BaseRenderer {
  protected doc: jsPDF;
  protected config: RenderConfig;
  protected position: PositionTracker;

  constructor(doc: jsPDF, config: RenderConfig, initialY: number) {
    this.doc = doc;
    this.config = config;
    this.position = new PositionTracker(
      initialY,
      config.pageHeight,
      config.margin,
    );
  }

  // ============================================================================
  // Basic Rendering Methods
  // ============================================================================

  /**
   * Draw text with wrapping
   */
  drawTextWithWrap(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize?: number,
  ): string[] {
    if (fontSize) {
      this.doc.setFontSize(fontSize);
    }
    return this.doc.splitTextToSize(text, maxWidth);
  }

  /**
   * Draw a line
   */
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number = 0.5,
  ): void {
    this.doc.setLineWidth(width);
    this.doc.line(x1, y1, x2, y2);
  }

  /**
   * Draw text at position
   */
  drawText(
    text: string,
    x: number,
    y: number,
    options?: { align?: 'left' | 'center' | 'right'; fontSize?: number },
  ): void {
    if (options?.fontSize) {
      this.doc.setFontSize(options.fontSize);
    }
    this.doc.text(text, x, y, options);
  }

  /**
   * Set font
   */
  setFont(
    family: string,
    style: 'normal' | 'bold' | 'italic' = 'normal',
  ): void {
    this.doc.setFont(family, style);
  }

  /**
   * Set font size
   */
  setFontSize(size: number): void {
    this.doc.setFontSize(size);
  }

  /**
   * Format currency value
   */
  formatCurrency(value: string): string {
    return formatCurrency(value, this.config.currency);
  }

  // ============================================================================
  // Position Management
  // ============================================================================

  getY(): number {
    return this.position.y;
  }

  setY(y: number): void {
    this.position.setY(y);
  }

  moveDown(amount: number): void {
    this.position.moveDown(amount);
  }

  checkPageBreak(requiredSpace: number): boolean {
    return this.position.checkPageBreak(this.doc, requiredSpace);
  }

  // ============================================================================
  // Layout Information
  // ============================================================================

  getPageWidth(): number {
    return this.config.pageWidth;
  }

  getPageHeight(): number {
    return this.config.pageHeight;
  }

  getMargin(): number {
    return this.config.margin;
  }

  // ============================================================================
  // Common Helper Functions
  // ============================================================================

  /**
   * Calculate row height based on number of label lines
   */
  calculateRowHeight(
    labelLines: string[],
    lineHeight: number,
    lineSpacing: number,
  ): number {
    return labelLines.length === 1
      ? lineHeight
      : (labelLines.length - 1) * lineSpacing + lineHeight;
  }

  /**
   * Draw label lines with indentation
   */
  drawLabelLines(
    labelLines: string[],
    startY: number,
    margin: number,
    indentOffset: number,
    lineSpacing: number,
  ): void {
    labelLines.forEach((line: string, index: number) => {
      this.drawText(line, margin + indentOffset, startY + index * lineSpacing);
    });
  }

  /**
   * Draw a line under a row
   */
  drawRowLine(
    startY: number,
    labelLines: string[],
    lineSpacing: number,
    margin: number,
    tableEndX: number,
    lineWidth: number = 0.1,
  ): void {
    const lastLineBaseline = startY + (labelLines.length - 1) * lineSpacing;
    const rowBottom = lastLineBaseline + 2;
    this.drawLine(margin, rowBottom, tableEndX, rowBottom, lineWidth);
  }

  /**
   * Draw target percentage text (no-op if target is null, undefined, or not a number)
   */
  drawTargetPercentage(
    targetPercent: number | null | undefined,
    x: number,
    y: number,
    fontSize: number = 9,
  ): void {
    if (
      targetPercent == null ||
      typeof targetPercent !== 'number' ||
      Number.isNaN(targetPercent)
    ) {
      return;
    }
    this.setFontSize(fontSize);
    this.setFont('helvetica', 'italic');
    const targetText = `Target: ${targetPercent.toFixed(2)}%`;
    this.drawText(targetText, x, y, { align: 'right' });
    this.setFont('helvetica', 'bold');
  }

  /**
   * Calculate text padding for label wrapping
   */
  calculateTextPadding(
    fontSize: number,
    multiplier: number,
    minPadding: number = 20,
  ): number {
    return Math.max(minPadding, fontSize * multiplier);
  }

  /**
   * Calculate text padding for bold text (takes more space)
   */
  calculateBoldTextPadding(
    fontSize: number,
    multiplier: number,
    minPadding: number = 35,
  ): number {
    return Math.max(minPadding, fontSize * multiplier);
  }

  /**
   * Draw wrapped total label lines
   */
  drawTotalLabelLines(
    totalLabel: string,
    margin: number,
    y: number,
    availableWidth: number,
    textPadding: number,
    lineSpacing: number,
  ): { lines: string[]; startY: number } {
    const totalLabelLines = this.drawTextWithWrap(
      totalLabel,
      margin,
      y,
      availableWidth - textPadding,
    );
    const totalStartY = y;

    totalLabelLines.forEach((line: string, index: number) => {
      this.drawText(line, margin, totalStartY + index * lineSpacing);
    });

    return { lines: totalLabelLines, startY: totalStartY };
  }

  /**
   * Check if a label contains a keyword (case-insensitive)
   */
  labelContainsKeyword(
    label: string | undefined | null,
    keyword: string,
  ): boolean {
    return label?.toUpperCase().includes(keyword.toUpperCase()) ?? false;
  }

  /**
   * Get constants for a specific mode
   */
  getModeConstants(isMonthly: boolean) {
    return isMonthly ? MONTHLY_MODE_CONSTANTS : PERIOD_MODE_CONSTANTS;
  }

  /**
   * Draw expenses section header (common pattern)
   */
  drawExpensesHeader(
    margin: number,
    tableEndX: number,
    headerFontSize: number,
    lineWidth: number,
  ): void {
    if (this.checkPageBreak(30)) {
      // Page break handled
    }

    // Expenses header
    this.setFontSize(headerFontSize);
    this.setFont('helvetica', 'bold');
    this.drawText('Expenses', margin, this.getY());
    this.moveDown(6);

    // Draw line under header
    this.drawLine(
      margin,
      this.getY() - 2,
      tableEndX,
      this.getY() - 2,
      lineWidth,
    );
    this.moveDown(4);
  }

  /**
   * Draw line under column headers (common pattern)
   */
  drawColumnHeaderLine(
    margin: number,
    tableEndX: number,
    lineWidth: number,
  ): void {
    this.drawLine(
      margin,
      this.getY() - 2,
      tableEndX,
      this.getY() - 2,
      lineWidth,
    );
    this.moveDown(3);
  }

  /**
   * Check if expense section is Fixed Expense (common pattern)
   */
  isFixedExpense(header: string | undefined | null): boolean {
    return this.labelContainsKeyword(header, 'FIXED');
  }

  // ============================================================================
  // Static Methods - Header Rendering
  // ============================================================================

  /**
   * Render PDF header (title, location, period, basis)
   * Returns the Y position after rendering
   */
  static renderHeader(options: {
    doc: jsPDF;
    title: string;
    locationName?: string | null;
    startDate: string;
    endDate: string;
    reportBasis?: string;
    pageWidth: number;
    margin: number;
    initialYPosition: number;
  }): number {
    const {
      doc,
      title,
      locationName,
      startDate,
      endDate,
      reportBasis,
      pageWidth,
      margin,
      initialYPosition,
    } = options;

    let yPosition = initialYPosition;

    // Title
    doc.setFontSize(PERIOD_MODE_CONSTANTS.titleFontSize);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, yPosition, {
      align: 'center',
    });
    yPosition += 10;

    // Location Name
    if (locationName) {
      doc.setFontSize(PERIOD_MODE_CONSTANTS.locationFontSize);
      doc.setFont('helvetica', 'normal');
      doc.text(locationName, pageWidth / 2, yPosition, {
        align: 'center',
      });
      yPosition += 8;
    }

    // Period
    doc.setFontSize(PERIOD_MODE_CONSTANTS.periodFontSize);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, yPosition, {
      align: 'center',
    });
    yPosition += 12;

    if (reportBasis) {
      doc.setFontSize(PERIOD_MODE_CONSTANTS.basisFontSize);
      doc.setFont('helvetica', 'normal');
      doc.text(`Basis: ${reportBasis}`, margin, yPosition);
      yPosition += 7;
    }

    yPosition += 5;

    return yPosition;
  }
}
