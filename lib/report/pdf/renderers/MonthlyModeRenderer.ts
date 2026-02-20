/**
 * Monthly Mode PDF Renderer
 *
 * Implements rendering strategy for monthly mode (multiple months) reports.
 * Follows Strategy Pattern and Single Responsibility Principle.
 */

import { MONTHLY_MODE_CONSTANTS } from '../constants';
import type {
  MonthlyExpenseSection,
  MonthlyReportData,
  MonthlySectionData,
  RenderStrategy,
  TargetPercentages,
} from '../types';
import { BaseRenderer } from './BaseRenderer';

/**
 * Monthly Mode Renderer Strategy
 */
export class MonthlyModeRenderer implements RenderStrategy {
  private months: Array<{ year: number; month: number }>;
  private incomeTotalForMonths: number[] = []; // Array of income totals for each month
  private incomeTotalForTotal: number = 0;
  private showMonthColumns: boolean;
  private numColumns: number;
  // Layout properties initialized in initializeLayout() before use
  private labelWidth: number = 0;
  private columnWidth: number = 0;
  private tableEndX: number = 0;

  constructor(months: Array<{ year: number; month: number }>) {
    this.months = months;
    this.showMonthColumns = months.length > 1;
    this.numColumns = this.showMonthColumns ? months.length + 1 : 1;
  }

  /**
   * Initialize layout calculations
   */
  private initializeLayout(renderer: BaseRenderer): void {
    const pageWidth = renderer.getPageWidth();
    const margin = renderer.getMargin();
    const availableWidth = pageWidth - 2 * margin;

    // Calculate label width
    this.labelWidth =
      this.months.length === 1
        ? availableWidth * 0.8
        : this.numColumns <= 3
          ? availableWidth * 0.4
          : this.numColumns <= 5
            ? availableWidth * 0.35
            : availableWidth * 0.3;

    // Calculate column width
    this.columnWidth =
      (pageWidth - 2 * margin - this.labelWidth) / (this.numColumns - 0.5);
    this.tableEndX = pageWidth - margin;
  }

  /**
   * Get month labels
   */
  private getMonthLabels(): string[] {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return this.months.map((m) => `${monthNames[m.month - 1]} ${m.year}`);
  }

  /**
   * Calculate percentage of income
   * For monthly columns: uses the corresponding month's income as base
   * For total column: uses the total income as base
   */
  private calculatePercentage(
    value: string,
    isTotalColumn: boolean = false,
    monthIndex?: number,
  ): string {
    if (!value) return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';

    let baseIncome: number;
    if (isTotalColumn) {
      // For total column, use total income
      baseIncome = this.incomeTotalForTotal;
    } else if (monthIndex !== undefined && monthIndex < this.incomeTotalForMonths.length) {
      // For monthly columns, use the corresponding month's income
      baseIncome = this.incomeTotalForMonths[monthIndex] || 0;
    } else {
      // Fallback: use first month's income if available
      baseIncome = this.incomeTotalForMonths[0] || 0;
    }

    if (baseIncome === 0) return '';

    const percentage = (numValue / baseIncome) * 100;
    if (Math.abs(percentage - 100) < 0.001) return '100%';
    return `${percentage.toFixed(2)}%`;
  }

  /**
   * Draw column headers (month labels)
   */
  private drawMonthColumnHeaders(renderer: BaseRenderer): void {
    const margin = renderer.getMargin();
    const monthLabels = this.getMonthLabels();
    let xPos = margin + this.labelWidth;

    renderer.setFontSize(7);
    renderer.setFont('helvetica', 'bold');

    if (this.showMonthColumns) {
      monthLabels.forEach((label) => {
        const truncatedLabel =
          label.length > 10 ? label.substring(0, 10) : label;
        renderer.drawText(truncatedLabel, xPos, renderer.getY(), {
          align: 'center',
        });
        xPos += this.columnWidth;
      });
    }

    // Always show Total column (or month label when only one month)
    const totalColumnLabel =
      this.months.length === 1 && this.months[0] ? monthLabels[0] : 'Total';
    renderer.drawText(totalColumnLabel, xPos, renderer.getY(), {
      align: 'center',
    });
    renderer.moveDown(3);
  }

  /**
   * Draw sub-headers (CUR and %)
   */
  private drawSubHeaders(renderer: BaseRenderer): void {
    const margin = renderer.getMargin();
    let xPos = margin + this.labelWidth;

    renderer.setFontSize(6);

    if (this.showMonthColumns) {
      this.months.forEach(() => {
        const curX = xPos - this.columnWidth / 2 + 3;
        const percentX = xPos + this.columnWidth / 2 - 3;
        renderer.drawText('CUR', curX, renderer.getY(), { align: 'left' });
        renderer.drawText('%', percentX, renderer.getY(), { align: 'right' });
        xPos += this.columnWidth;
      });
    }

    // Total column
    const totalCurX = this.showMonthColumns
      ? xPos - this.columnWidth / 2 + 3
      : xPos - this.columnWidth / 2;
    const totalPercentX = xPos + this.columnWidth / 2 - 3;
    renderer.drawText('CUR', totalCurX, renderer.getY(), { align: 'left' });
    renderer.drawText('%', totalPercentX, renderer.getY(), { align: 'right' });
    renderer.moveDown(4);
  }

  /**
   * Draw section header
   */
  private drawSectionHeader(
    renderer: BaseRenderer,
    header: string,
    isImportant: boolean = false,
  ): void {
    const margin = renderer.getMargin();
    const tableEndX = this.tableEndX;

    if (renderer.checkPageBreak(30)) {
      // Page break handled
    }

    renderer.setFontSize(isImportant ? 11 : 10);
    renderer.setFont('helvetica', 'bold');
    renderer.drawText(header, margin, renderer.getY());
    renderer.moveDown(6);

    // Draw line under header
    renderer.drawLine(
      margin,
      renderer.getY() - 2,
      tableEndX,
      renderer.getY() - 2,
      0.3,
    );
    renderer.moveDown(4);

    // Column headers
    this.drawMonthColumnHeaders(renderer);
    this.drawSubHeaders(renderer);

    // Draw line under column headers (common pattern)
    renderer.drawColumnHeaderLine(margin, tableEndX, 0.3);
  }

  /**
   * Draw section items
   */
  private drawSectionItems(
    renderer: BaseRenderer,
    section: MonthlySectionData,
  ): void {
    const margin = renderer.getMargin();
    const pageHeight = renderer.getPageHeight();
    const lineHeight = MONTHLY_MODE_CONSTANTS.lineHeight;
    const lineSpacing = MONTHLY_MODE_CONSTANTS.lineSpacing;
    const tableEndX = this.tableEndX;

    renderer.setFontSize(8);
    renderer.setFont('helvetica', 'normal');

    section.items.forEach((item) => {
      if (renderer.checkPageBreak(lineHeight)) {
        renderer.setFontSize(8);
        renderer.setFont('helvetica', 'normal');
      }

      const indentOffset = item.indent ? item.indent * 8 : 0;
      const textPadding =
        this.months.length === 1 ? Math.max(10, 8 * 1.5) : Math.max(20, 8 * 3);
      const baseAvailableWidth = this.labelWidth - indentOffset - textPadding;
      const availableLabelWidth =
        this.months.length === 1
          ? baseAvailableWidth * 0.95
          : baseAvailableWidth * 0.8;

      const labelLines = renderer.drawTextWithWrap(
        item.label,
        margin,
        renderer.getY(),
        Math.max(availableLabelWidth, 15),
      );
      const startY = renderer.getY();

      const rowHeight = renderer.calculateRowHeight(
        labelLines,
        lineHeight,
        lineSpacing,
      );

      // Draw label with indentation (Monthly mode has special handling for overflow)
      labelLines.forEach((line: string, index: number) => {
        const maxX = margin + this.labelWidth - 5;
        const lineX = margin + indentOffset;
        const lineWidth = renderer['doc'].getTextWidth(line);
        if (lineWidth + lineX > maxX) {
          // Emergency fallback: split again with even smaller width
          const emergencyWidth = maxX - lineX - 2;
          const emergencyLines = renderer['doc'].splitTextToSize(
            line,
            Math.max(emergencyWidth, 10),
          );
          emergencyLines.forEach(
            (emergencyLine: string, emergencyIndex: number) => {
              renderer.drawText(
                emergencyLine,
                lineX,
                startY + (index + emergencyIndex) * lineSpacing,
              );
            },
          );
        } else {
          renderer.drawText(line, lineX, startY + index * lineSpacing);
        }
      });

      // Draw values and percentages
      this.drawItemValues(renderer, item, startY);

      // Draw line under row
      renderer.drawRowLine(
        startY,
        labelLines,
        lineSpacing,
        margin,
        tableEndX,
        0.1,
      );

      renderer.setFontSize(8);
      renderer.setFont('helvetica', 'normal');
      renderer.setY(startY + rowHeight);
    });
  }

  /**
   * Draw item values (monthly columns)
   */
  private drawItemValues(
    renderer: BaseRenderer,
    item: {
      values: string[];
      total: string;
    },
    startY: number,
  ): void {
    const margin = renderer.getMargin();
    let xPos = margin + this.labelWidth;

    if (this.showMonthColumns) {
      item.values.forEach((value, monthIndex) => {
        const formattedValue = renderer.formatCurrency(value);
        const percentage = this.calculatePercentage(value, false, monthIndex);

        const valueX = xPos - this.columnWidth / 2 + 3;
        const percentX = xPos + this.columnWidth / 2 - 3;

        renderer.setFontSize(8);
        renderer.drawText(formattedValue, valueX, startY, { align: 'left' });

        if (percentage) {
          renderer.setFontSize(8);
          renderer.drawText(percentage, percentX, startY, { align: 'right' });
        }

        xPos += this.columnWidth;
      });
    }

    // Draw total value
    const totalValue = renderer.formatCurrency(item.total);
    const totalPercentage = this.calculatePercentage(item.total, true);
    const totalValueX = this.showMonthColumns
      ? xPos - this.columnWidth / 2 + 3
      : xPos - this.columnWidth / 2;
    const totalPercentX = xPos + this.columnWidth / 2 - 3;

    renderer.setFontSize(8);
    renderer.drawText(totalValue, totalValueX, startY, { align: 'left' });

    if (totalPercentage) {
      renderer.setFontSize(8);
      renderer.drawText(totalPercentage, totalPercentX, startY, {
        align: 'right',
      });
    }
  }

  /**
   * Draw section total
   */
  private drawSectionTotal(
    renderer: BaseRenderer,
    section: MonthlySectionData,
    isImportant: boolean,
    targetPercent?: number,
  ): void {
    if (!section.total) return;

    const margin = renderer.getMargin();
    const lineHeight = MONTHLY_MODE_CONSTANTS.lineHeight;
    const lineSpacing = MONTHLY_MODE_CONSTANTS.lineSpacing;
    const sectionSpacing = MONTHLY_MODE_CONSTANTS.sectionSpacing;

    if (renderer.checkPageBreak(lineHeight + 2)) {
      // Page break handled
    }

    renderer.moveDown(2);
    renderer.setFontSize(isImportant ? 10 : 9);
    renderer.setFont('helvetica', 'bold');

    const currentFontSize = isImportant ? 10 : 9;
    const textPadding =
      this.months.length === 1
        ? Math.max(10, currentFontSize * 1.5)
        : renderer.calculateBoldTextPadding(currentFontSize, 2.5, 20);
    // Use full labelWidth for total labels (don't reduce with multiplier)
    // drawTotalLabelLines will subtract textPadding internally
    const availableLabelWidth = this.labelWidth;

    const { lines: totalLabelLines, startY: totalStartY } =
      renderer.drawTotalLabelLines(
        section.total.label,
        margin,
        renderer.getY(),
        availableLabelWidth,
        textPadding,
        lineSpacing,
      );

    const totalRowHeight = renderer.calculateRowHeight(
      totalLabelLines,
      lineHeight,
      lineSpacing,
    );

    // Draw total values
    this.drawTotalValues(renderer, section.total, totalStartY, targetPercent);

    renderer.setY(totalStartY + totalRowHeight + sectionSpacing);
  }

  /**
   * Draw total values (monthly columns)
   */
  private drawTotalValues(
    renderer: BaseRenderer,
    total: {
      values: string[];
      total: string;
    },
    startY: number,
    targetPercent?: number,
  ): void {
    const margin = renderer.getMargin();
    let xPos = margin + this.labelWidth;

    if (this.showMonthColumns) {
      total.values.forEach((value, monthIndex) => {
        const formattedValue = renderer.formatCurrency(value);
        const percentage = this.calculatePercentage(value, false, monthIndex);

        const valueX = xPos - this.columnWidth / 2 + 3;
        const percentX = xPos + this.columnWidth / 2 - 3;

        renderer.setFontSize(8);
        renderer.drawText(formattedValue, valueX, startY, { align: 'left' });

        if (percentage) {
          renderer.setFontSize(8);
          renderer.drawText(percentage, percentX, startY, { align: 'right' });
        }

        xPos += this.columnWidth;
      });
    }

    // Draw total column
    const totalValue = renderer.formatCurrency(total.total);
    const totalPercentage = this.calculatePercentage(total.total, true);
    const totalValueX = this.showMonthColumns
      ? xPos - this.columnWidth / 2 + 3
      : xPos - this.columnWidth / 2;
    const totalPercentX = xPos + this.columnWidth / 2 - 3;

    renderer.setFontSize(8);
    renderer.drawText(totalValue, totalValueX, startY, { align: 'left' });

    if (totalPercentage) {
      renderer.setFontSize(8);
      renderer.drawText(totalPercentage, totalPercentX, startY, {
        align: 'right',
      });
    }

    // Draw target percentage if available
    if (targetPercent !== undefined) {
      const targetY = startY + 3;
      const targetX = totalPercentX;
      renderer.drawTargetPercentage(targetPercent, targetX, targetY, 8);
    }
  }

  /**
   * Draw a section (Income, Cost of Sales, Other Income)
   */
  private drawSection(
    renderer: BaseRenderer,
    section: MonthlySectionData | null,
    isImportant: boolean = false,
    targetPercent?: number,
  ): void {
    if (!section) return;

    this.drawSectionHeader(renderer, section.header, isImportant);
    this.drawSectionItems(renderer, section);
    this.drawSectionTotal(renderer, section, isImportant, targetPercent);
  }

  /**
   * Draw gross profit
   */
  private drawGrossProfit(
    renderer: BaseRenderer,
    grossProfit: { label: string; values: string[]; total: string } | null,
  ): void {
    if (!grossProfit) return;

    const margin = renderer.getMargin();
    const lineHeight = MONTHLY_MODE_CONSTANTS.lineHeight;
    const sectionSpacing = MONTHLY_MODE_CONSTANTS.sectionSpacing;

    if (renderer.checkPageBreak(15)) {
      // Page break handled
    }

    renderer.setFontSize(10);
    renderer.setFont('helvetica', 'bold');
    renderer.drawText(grossProfit.label, margin, renderer.getY());

    // Draw gross profit values
    this.drawItemValues(renderer, grossProfit, renderer.getY());

    renderer.moveDown(lineHeight + sectionSpacing);
  }

  /**
   * Draw expenses section
   */
  private drawExpenses(
    renderer: BaseRenderer,
    expenses: {
      sections: MonthlyExpenseSection[];
      total: { label: string; values: string[]; total: string } | null;
    },
    targetPercentages?: TargetPercentages,
  ): void {
    if (expenses.sections.length === 0 && !expenses.total) return;

    const margin = renderer.getMargin();
    const tableEndX = this.tableEndX;

    // Draw expenses header (common pattern)
    renderer.drawExpensesHeader(margin, tableEndX, 10, 0.3);

    // Column headers
    this.drawMonthColumnHeaders(renderer);
    this.drawSubHeaders(renderer);

    // Draw line under column headers (common pattern)
    renderer.drawColumnHeaderLine(margin, tableEndX, 0.3);

    // Draw each expense sub-section
    expenses.sections.forEach((expenseSection, sectionIndex) => {
      this.drawExpenseSection(
        renderer,
        expenseSection,
        sectionIndex,
        targetPercentages,
      );
    });

    // Total for Expenses
    if (expenses.total) {
      this.drawExpensesTotal(renderer, expenses.total);
    }
  }

  /**
   * Draw expense sub-section
   */
  private drawExpenseSection(
    renderer: BaseRenderer,
    expenseSection: MonthlyExpenseSection,
    sectionIndex: number,
    targetPercentages?: TargetPercentages,
  ): void {
    const margin = renderer.getMargin();
    const lineHeight = MONTHLY_MODE_CONSTANTS.lineHeight;
    const tableEndX = this.tableEndX;

    if (renderer.checkPageBreak(20)) {
      // Page break handled
    }

    if (sectionIndex > 0) {
      renderer.moveDown(3);
    }

    const isFixedExpense = renderer.isFixedExpense(expenseSection.header);

    // Sub-section header
    renderer.setFontSize(10);
    renderer.setFont('helvetica', 'bold');
    renderer.drawText(expenseSection.header, margin, renderer.getY());
    renderer.moveDown(6);

    // Items - skip for Fixed Expense
    if (!isFixedExpense) {
      this.drawSectionItems(renderer, expenseSection);
    }

    // Sub-section total
    if (expenseSection.total) {
      this.drawExpenseSectionTotal(renderer, expenseSection, targetPercentages);
    }
  }

  /**
   * Draw expense section total
   */
  private drawExpenseSectionTotal(
    renderer: BaseRenderer,
    expenseSection: MonthlyExpenseSection,
    targetPercentages?: TargetPercentages,
  ): void {
    if (!expenseSection.total) return;

    const margin = renderer.getMargin();
    const lineHeight = MONTHLY_MODE_CONSTANTS.lineHeight;
    const lineSpacing = MONTHLY_MODE_CONSTANTS.lineSpacing;
    const tableEndX = this.tableEndX;

    if (renderer.checkPageBreak(lineHeight + 3)) {
      // Page break handled
    }

    renderer.moveDown(2);
    renderer.setFontSize(9);
    renderer.setFont('helvetica', 'bold');

    const currentFontSize = 9;
    const textPadding =
      this.months.length === 1
        ? Math.max(10, currentFontSize * 1.5)
        : renderer.calculateBoldTextPadding(currentFontSize, 2.5, 20);
    // Use full labelWidth for total labels (don't reduce with multiplier)
    // drawTotalLabelLines will subtract textPadding internally
    const availableLabelWidth = this.labelWidth;

    const { lines: totalLabelLines, startY: totalStartY } =
      renderer.drawTotalLabelLines(
        expenseSection.total.label,
        margin,
        renderer.getY(),
        availableLabelWidth,
        textPadding,
        lineSpacing,
      );

    const totalRowHeight = renderer.calculateRowHeight(
      totalLabelLines,
      lineHeight,
      lineSpacing,
    );

    // Check if this is Payroll
    const isPayroll = renderer.labelContainsKeyword(
      expenseSection.total.label,
      'PAYROLL',
    );
    const payrollTargetPercent = isPayroll
      ? targetPercentages?.payroll
      : undefined;

    // Draw total values
    this.drawTotalValues(
      renderer,
      expenseSection.total,
      totalStartY,
      payrollTargetPercent,
    );

    renderer.setY(totalStartY + totalRowHeight + 2);

    // Draw line after expense sub-section
    renderer.moveDown(2);
    renderer.drawLine(margin, renderer.getY(), tableEndX, renderer.getY(), 0.2);
    renderer.moveDown(3);
  }

  /**
   * Draw expenses total
   */
  private drawExpensesTotal(
    renderer: BaseRenderer,
    expensesTotal: { label: string; values: string[]; total: string },
  ): void {
    const margin = renderer.getMargin();
    const lineHeight = MONTHLY_MODE_CONSTANTS.lineHeight;
    const lineSpacing = MONTHLY_MODE_CONSTANTS.lineSpacing;
    const sectionSpacing = MONTHLY_MODE_CONSTANTS.sectionSpacing;

    if (renderer.checkPageBreak(lineHeight + 5)) {
      // Page break handled
    }

    renderer.moveDown(2);
    renderer.setFontSize(9);
    renderer.setFont('helvetica', 'bold');

    const currentFontSize = 9;
    const textPadding =
      this.months.length === 1
        ? Math.max(10, currentFontSize * 1.5)
        : renderer.calculateBoldTextPadding(currentFontSize, 2.5, 20);
    // Use full labelWidth for total labels (don't reduce with multiplier)
    // drawTotalLabelLines will subtract textPadding internally
    const availableLabelWidth = this.labelWidth;

    const { lines: totalLabelLines, startY: totalStartY } =
      renderer.drawTotalLabelLines(
        expensesTotal.label,
        margin,
        renderer.getY(),
        availableLabelWidth,
        textPadding,
        lineSpacing,
      );

    const totalRowHeight = renderer.calculateRowHeight(
      totalLabelLines,
      lineHeight,
      lineSpacing,
    );

    // Draw total values
    this.drawTotalValues(renderer, expensesTotal, totalStartY);

    renderer.setY(totalStartY + totalRowHeight + sectionSpacing);
  }

  /**
   * Draw profit
   */
  private drawProfit(
    renderer: BaseRenderer,
    profit: { label: string; values: string[]; total: string } | null,
    targetPercentages?: TargetPercentages,
  ): void {
    if (!profit) return;

    const margin = renderer.getMargin();

    if (renderer.checkPageBreak(20)) {
      // Page break handled
    }

    renderer.moveDown(2);

    renderer.setFontSize(9);
    renderer.setFont('helvetica', 'bold');
    renderer.drawText(profit.label, margin, renderer.getY());

    // Draw profit values
    this.drawItemValues(renderer, profit, renderer.getY());

    // Draw target percentage if available
    if (targetPercentages?.profit !== undefined) {
      const xPos =
        margin + this.labelWidth + (this.numColumns - 1) * this.columnWidth;
      const totalPercentX = xPos + this.columnWidth / 2 - 3;
      const targetY = renderer.getY() + 3;
      renderer.drawTargetPercentage(
        targetPercentages.profit,
        totalPercentX,
        targetY,
        8,
      );
    }
  }

  /**
   * Render the complete PDF report (Strategy interface implementation)
   */
  render(
    renderer: BaseRenderer,
    parsedData: MonthlyReportData,
    targetPercentages?: TargetPercentages,
  ): void {
    // Initialize layout
    this.initializeLayout(renderer);

    // Set income totals for percentage calculations
    // Store income for each month (for monthly column % calculations)
    this.incomeTotalForMonths = parsedData.income?.total?.values
      ? parsedData.income.total.values.map((val) => parseFloat(val || '0'))
      : [];
    // Store total income (for total column % calculation)
    this.incomeTotalForTotal = parsedData.income?.total?.total
      ? parseFloat(parsedData.income.total.total)
      : 0;

    // Draw Income
    this.drawSection(renderer, parsedData.income);

    // Draw Cost of Sales with target percentage
    this.drawSection(
      renderer,
      parsedData.costOfSales,
      false,
      targetPercentages?.costOfSales,
    );

    // // Draw Gross Profit
    // this.drawGrossProfit(renderer, parsedData.grossProfit);

    // Draw Expenses
    this.drawExpenses(renderer, parsedData.expenses, targetPercentages);

    // Draw Other Income
    this.drawSection(renderer, parsedData.otherIncome);

    // Draw Profit
    this.drawProfit(renderer, parsedData.profit, targetPercentages);
  }
}
