/**
 * Period Mode PDF Renderer
 *
 * Implements rendering strategy for period mode (single period) reports.
 * Follows Strategy Pattern and Single Responsibility Principle.
 */

import { PERIOD_MODE_CONSTANTS } from '../constants';
import type {
  SectionData,
  ExpenseSection,
  PeriodReportData,
  TargetPercentages,
} from '../types';
import { BaseRenderer } from './BaseRenderer';
import type { RenderStrategy } from '../types';

/**
 * Period Mode Renderer Strategy
 */
export class PeriodModeRenderer implements RenderStrategy {
  private incomeTotal: number = 0;

  /**
   * Calculate percentage of income
   */
  private calculatePercentage(value: string): string {
    if (!value || this.incomeTotal === 0) return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';
    const percentage = (numValue / this.incomeTotal) * 100;
    if (Math.abs(percentage - 100) < 0.001) return '100%';
    return `${percentage.toFixed(2)}%`;
  }

  /**
   * Draw a section (Income, Cost of Sales, Other Income)
   */
  private drawSection(
    renderer: BaseRenderer,
    section: SectionData | null,
    isImportant: boolean = false,
    targetPercent?: number,
  ): void {
    if (!section) return;

    const margin = renderer.getMargin();
    const pageHeight = renderer.getPageHeight();
    const tableEndX = this.calculateTableEndX(renderer);

    // Check page break
    if (renderer.checkPageBreak(30)) {
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.itemFontSize);
      renderer.setFont('helvetica', 'normal');
    }

    // Section header
    renderer.setFontSize(isImportant ? 13 : 12);
    renderer.setFont('helvetica', 'bold');
    renderer.drawText(section.header, margin, renderer.getY());
    renderer.moveDown(8);

    // Draw line under header
    renderer.drawLine(
      margin,
      renderer.getY() - 2,
      tableEndX,
      renderer.getY() - 2,
      0.5,
    );
    renderer.moveDown(5);

    // Column headers
    this.drawColumnHeaders(renderer);
    renderer.moveDown(3);

    // Draw line under column headers
    renderer.drawLine(
      margin,
      renderer.getY() - 2,
      tableEndX,
      renderer.getY() - 2,
      PERIOD_MODE_CONSTANTS.lineWidth.columnHeader,
    );
    renderer.moveDown(3);

    // Draw items
    this.drawSectionItems(renderer, section);

    // Draw total
    this.drawSectionTotal(renderer, section, isImportant, targetPercent);
  }

  /**
   * Draw column headers
   */
  private drawColumnHeaders(renderer: BaseRenderer): void {
    const margin = renderer.getMargin();
    const labelWidth = this.calculateLabelWidth(renderer);
    const valueWidth = this.calculateValueWidth(renderer);
    const percentageWidth = this.calculatePercentageWidth(renderer);

    renderer.setFontSize(PERIOD_MODE_CONSTANTS.columnHeaderFontSize);
    renderer.setFont('helvetica', 'bold');
    renderer.drawText('CURRENT', margin + labelWidth, renderer.getY(), {
      align: 'right',
    });
    renderer.drawText(
      '% of Income',
      margin + labelWidth + valueWidth + percentageWidth,
      renderer.getY(),
      {
        align: 'right',
      },
    );
    renderer.moveDown(6);
  }

  /**
   * Draw section items
   */
  private drawSectionItems(renderer: BaseRenderer, section: SectionData): void {
    const margin = renderer.getMargin();
    const pageHeight = renderer.getPageHeight();
    const labelWidth = this.calculateLabelWidth(renderer);
    const valueWidth = this.calculateValueWidth(renderer);
    const lineHeight = PERIOD_MODE_CONSTANTS.lineHeight;
    const lineSpacing = PERIOD_MODE_CONSTANTS.lineSpacing;
    const tableEndX = this.calculateTableEndX(renderer);

    renderer.setFontSize(PERIOD_MODE_CONSTANTS.itemFontSize);
    renderer.setFont('helvetica', 'normal');

    section.items.forEach((item) => {
      if (renderer.checkPageBreak(lineHeight)) {
        renderer.setFontSize(PERIOD_MODE_CONSTANTS.itemFontSize);
        renderer.setFont('helvetica', 'normal');
      }

      const textPadding = Math.max(
        20,
        PERIOD_MODE_CONSTANTS.itemFontSize *
          PERIOD_MODE_CONSTANTS.textPaddingMultiplier,
      );
      const labelLines = renderer.drawTextWithWrap(
        item.label,
        margin,
        renderer.getY(),
        labelWidth - textPadding,
      );
      const startY = renderer.getY();

      const rowHeight = renderer.calculateRowHeight(
        labelLines,
        lineHeight,
        lineSpacing,
      );

      // Draw label lines
      renderer.drawLabelLines(labelLines, startY, margin, 0, lineSpacing);

      const value = renderer.formatCurrency(item.value);
      const percentage = this.calculatePercentage(item.value);
      const percentageWidth = this.calculatePercentageWidth(renderer);
      renderer.drawText(value, margin + labelWidth, startY, { align: 'right' });
      if (percentage) {
        renderer.setFontSize(PERIOD_MODE_CONSTANTS.targetFontSize.normal);
        renderer.drawText(
          percentage,
          margin + labelWidth + valueWidth + percentageWidth,
          startY,
          {
            align: 'right',
          },
        );
        renderer.setFontSize(PERIOD_MODE_CONSTANTS.itemFontSize);
      }

      // Draw line under row
      renderer.drawRowLine(
        startY,
        labelLines,
        lineSpacing,
        margin,
        tableEndX,
        0.1,
      );

      renderer.setY(startY + rowHeight);
    });
  }

  /**
   * Draw section total
   */
  private drawSectionTotal(
    renderer: BaseRenderer,
    section: SectionData,
    isImportant: boolean,
    targetPercent?: number,
  ): void {
    if (!section.total.label || !section.total.value) return;

    const margin = renderer.getMargin();
    const labelWidth = this.calculateLabelWidth(renderer);
    const valueWidth = this.calculateValueWidth(renderer);
    const lineHeight = PERIOD_MODE_CONSTANTS.lineHeight;
    const lineSpacing = PERIOD_MODE_CONSTANTS.lineSpacing;
    const sectionSpacing = PERIOD_MODE_CONSTANTS.sectionSpacing;

    if (renderer.checkPageBreak(lineHeight + 3)) {
      // Page break handled
    }

    renderer.moveDown(3);
    renderer.setFontSize(isImportant ? 12 : 11);
    renderer.setFont('helvetica', 'bold');

    const currentFontSize = isImportant ? 12 : 11;
    const textPadding = renderer.calculateBoldTextPadding(currentFontSize, 3.5);
    const { lines: totalLabelLines, startY: totalStartY } =
      renderer.drawTotalLabelLines(
        section.total.label,
        margin,
        renderer.getY(),
        labelWidth,
        textPadding,
        lineSpacing,
      );

    const totalRowHeight = renderer.calculateRowHeight(
      totalLabelLines,
      lineHeight,
      lineSpacing,
    );

    const totalValue = renderer.formatCurrency(section.total.value);
    const totalPercentage = this.calculatePercentage(section.total.value);
    const percentageWidth = this.calculatePercentageWidth(renderer);
    renderer.drawText(totalValue, margin + labelWidth, totalStartY, {
      align: 'right',
    });
    if (totalPercentage) {
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.targetFontSize.normal);
      renderer.drawText(
        totalPercentage,
        margin + labelWidth + valueWidth + percentageWidth,
        totalStartY,
        {
          align: 'right',
        },
      );
      renderer.setFontSize(
        isImportant
          ? PERIOD_MODE_CONSTANTS.totalFontSize.important
          : PERIOD_MODE_CONSTANTS.totalFontSize.normal,
      );
    }

    // Draw target percentage if available
    if (targetPercent !== undefined) {
      const targetX = margin + labelWidth + valueWidth + percentageWidth;
      const targetY = totalStartY + 3;
      renderer.drawTargetPercentage(
        targetPercent,
        targetX,
        targetY,
        PERIOD_MODE_CONSTANTS.targetFontSize.normal,
      );
    }

    renderer.setY(totalStartY + totalRowHeight + sectionSpacing);
  }

  /**
   * Draw gross profit
   */
  private drawGrossProfit(
    renderer: BaseRenderer,
    grossProfit: { label: string; value: string } | null,
  ): void {
    if (!grossProfit) return;

    const margin = renderer.getMargin();
    const pageHeight = renderer.getPageHeight();
    const labelWidth = this.calculateLabelWidth(renderer);
    const valueWidth = this.calculateValueWidth(renderer);
    const lineHeight = PERIOD_MODE_CONSTANTS.lineHeight;
    const sectionSpacing = PERIOD_MODE_CONSTANTS.sectionSpacing;
    const tableEndX = this.calculateTableEndX(renderer);

    if (renderer.checkPageBreak(15)) {
      // Page break handled
    }

    // Column headers
    this.drawColumnHeaders(renderer);

    renderer.setFontSize(PERIOD_MODE_CONSTANTS.totalFontSize.important);
    renderer.setFont('helvetica', 'bold');
    const grossProfitValue = renderer.formatCurrency(grossProfit.value);
    const grossProfitPercentage = this.calculatePercentage(grossProfit.value);
    const percentageWidth = this.calculatePercentageWidth(renderer);
    renderer.drawText(grossProfit.label, margin, renderer.getY());
    renderer.drawText(grossProfitValue, margin + labelWidth, renderer.getY(), {
      align: 'right',
    });
    if (grossProfitPercentage) {
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.targetFontSize.normal);
      renderer.drawText(
        grossProfitPercentage,
        margin + labelWidth + valueWidth + percentageWidth,
        renderer.getY(),
        {
          align: 'right',
        },
      );
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.totalFontSize.important);
    }
    renderer.moveDown(lineHeight + sectionSpacing);
  }

  /**
   * Draw expenses section
   */
  private drawExpenses(
    renderer: BaseRenderer,
    expenses: {
      sections: ExpenseSection[];
      total: { label: string; value: string } | null;
    },
    targetPercentages?: TargetPercentages,
  ): void {
    if (expenses.sections.length === 0 && !expenses.total) return;

    const margin = renderer.getMargin();
    const tableEndX = this.calculateTableEndX(renderer);

    // Draw expenses header (common pattern)
    renderer.drawExpensesHeader(
      margin,
      tableEndX,
      PERIOD_MODE_CONSTANTS.sectionHeaderFontSize.normal,
      PERIOD_MODE_CONSTANTS.lineWidth.header,
    );
    renderer.moveDown(1); // Additional spacing for period mode

    // Column headers
    this.drawColumnHeaders(renderer);

    // Draw line under column headers (common pattern)
    renderer.drawColumnHeaderLine(
      margin,
      tableEndX,
      PERIOD_MODE_CONSTANTS.lineWidth.columnHeader,
    );

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
    expenseSection: ExpenseSection,
    sectionIndex: number,
    targetPercentages?: TargetPercentages,
  ): void {
    const margin = renderer.getMargin();
    const pageHeight = renderer.getPageHeight();
    const labelWidth = this.calculateLabelWidth(renderer);
    const valueWidth = this.calculateValueWidth(renderer);
    const lineHeight = PERIOD_MODE_CONSTANTS.lineHeight;
    const lineSpacing = PERIOD_MODE_CONSTANTS.lineSpacing;
    const tableEndX = this.calculateTableEndX(renderer);

    if (renderer.checkPageBreak(20)) {
      // Page break handled
    }

    if (sectionIndex > 0) {
      renderer.moveDown(3);
    }

    const isFixedExpense = renderer.isFixedExpense(expenseSection.header);

    // Sub-section header
    renderer.setFontSize(PERIOD_MODE_CONSTANTS.totalFontSize.normal);
    renderer.setFont('helvetica', 'bold');
    renderer.drawText(expenseSection.header, margin, renderer.getY());
    renderer.moveDown(7);

    // Items - skip for Fixed Expense
    if (!isFixedExpense) {
      // Calculate minimum indent level to normalize indentation
      // If no top-level items (indent 0), reduce all indents by the minimum
      const minIndent = expenseSection.items.reduce((min, item) => {
        const indent = item.indent ?? 0;
        return indent < min ? indent : min;
      }, Infinity);
      const indentOffsetBase = minIndent > 0 ? minIndent : 0;

      renderer.setFontSize(PERIOD_MODE_CONSTANTS.itemFontSize);
      renderer.setFont('helvetica', 'normal');
      expenseSection.items.forEach((item) => {
        if (renderer.checkPageBreak(lineHeight)) {
          renderer.setFontSize(PERIOD_MODE_CONSTANTS.itemFontSize);
          renderer.setFont('helvetica', 'normal');
        }

        // Normalize indent: subtract minimum indent so top-level items have indent 0
        const normalizedIndent = item.indent ? item.indent - indentOffsetBase : 0;
        const indentOffset = normalizedIndent > 0
          ? normalizedIndent * PERIOD_MODE_CONSTANTS.indentPerLevel
          : 0;
        const textPadding = Math.max(
          20,
          PERIOD_MODE_CONSTANTS.itemFontSize *
            PERIOD_MODE_CONSTANTS.textPaddingMultiplier,
        );
        const labelLines = renderer.drawTextWithWrap(
          item.label,
          margin,
          renderer.getY(),
          labelWidth - textPadding - indentOffset,
        );
        const startY = renderer.getY();

        const rowHeight =
          labelLines.length === 1
            ? lineHeight
            : (labelLines.length - 1) * lineSpacing + lineHeight;

        renderer.drawLabelLines(
          labelLines,
          startY,
          margin,
          10 + indentOffset,
          lineSpacing,
        );

        const value = renderer.formatCurrency(item.value);
        const percentage = this.calculatePercentage(item.value);
        const percentageWidth = this.calculatePercentageWidth(renderer);
        renderer.setFontSize(PERIOD_MODE_CONSTANTS.itemFontSize);
        renderer.setFont('helvetica', 'normal');
        renderer.drawText(value, margin + labelWidth, startY, {
          align: 'right',
        });
        if (percentage) {
          renderer.setFontSize(PERIOD_MODE_CONSTANTS.targetFontSize.normal);
          renderer.drawText(
            percentage,
            margin + labelWidth + valueWidth + percentageWidth,
            startY,
            {
              align: 'right',
            },
          );
          renderer.setFontSize(PERIOD_MODE_CONSTANTS.itemFontSize);
          renderer.setFont('helvetica', 'normal');
        }

        renderer.drawRowLine(
          startY,
          labelLines,
          lineSpacing,
          margin,
          tableEndX,
          0.05,
        );

        renderer.setY(startY + rowHeight);
      });
    }

    // Sub-section total
    if (expenseSection.total.label && expenseSection.total.value) {
      this.drawExpenseSectionTotal(renderer, expenseSection, targetPercentages);
    }
  }

  /**
   * Draw expense section total
   */
  private drawExpenseSectionTotal(
    renderer: BaseRenderer,
    expenseSection: ExpenseSection,
    targetPercentages?: TargetPercentages,
  ): void {
    const margin = renderer.getMargin();
    const pageHeight = renderer.getPageHeight();
    const labelWidth = this.calculateLabelWidth(renderer);
    const valueWidth = this.calculateValueWidth(renderer);
    const lineHeight = PERIOD_MODE_CONSTANTS.lineHeight;
    const lineSpacing = PERIOD_MODE_CONSTANTS.lineSpacing;
    const tableEndX = this.calculateTableEndX(renderer);

    if (renderer.checkPageBreak(lineHeight + 3)) {
      // Page break handled
    }

    renderer.moveDown(3);
    renderer.setFontSize(10);
    renderer.setFont('helvetica', 'bold');

    const currentFontSize = PERIOD_MODE_CONSTANTS.itemFontSize;
    const textPadding = renderer.calculateBoldTextPadding(
      currentFontSize,
      PERIOD_MODE_CONSTANTS.boldTextPaddingMultiplier,
    );
    const { lines: totalLabelLines, startY: totalStartY } =
      renderer.drawTotalLabelLines(
        expenseSection.total.label,
        margin,
        renderer.getY(),
        labelWidth,
        textPadding,
        lineSpacing,
      );

    const totalRowHeight = renderer.calculateRowHeight(
      totalLabelLines,
      lineHeight,
      lineSpacing,
    );

    const totalValue = renderer.formatCurrency(expenseSection.total.value);
    const totalPercentage = this.calculatePercentage(
      expenseSection.total.value,
    );
    const percentageWidth = this.calculatePercentageWidth(renderer);
    renderer.drawText(totalValue, margin + labelWidth, totalStartY, {
      align: 'right',
    });
    if (totalPercentage) {
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.targetFontSize.normal);
      renderer.drawText(
        totalPercentage,
        margin + labelWidth + valueWidth + percentageWidth,
        totalStartY,
        {
          align: 'right',
        },
      );
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.itemFontSize);
    }

    // Check if this is Payroll and has target percentage
    const isPayroll = renderer.labelContainsKeyword(
      expenseSection.total.label,
      'PAYROLL',
    );
    if (isPayroll && targetPercentages?.payroll !== undefined) {
      const targetX = margin + labelWidth + valueWidth + percentageWidth;
      const targetY = totalStartY + 3;
      renderer.drawTargetPercentage(
        targetPercentages.payroll,
        targetX,
        targetY,
        PERIOD_MODE_CONSTANTS.targetFontSize.normal,
      );
    }

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
    expensesTotal: { label: string; value: string },
  ): void {
    const margin = renderer.getMargin();
    const labelWidth = this.calculateLabelWidth(renderer);
    const valueWidth = this.calculateValueWidth(renderer);
    const lineHeight = PERIOD_MODE_CONSTANTS.lineHeight;
    const lineSpacing = PERIOD_MODE_CONSTANTS.lineSpacing;
    const sectionSpacing = PERIOD_MODE_CONSTANTS.sectionSpacing;

    if (renderer.checkPageBreak(lineHeight + 5)) {
      // Page break handled
    }

    renderer.moveDown(5);
    renderer.setFontSize(PERIOD_MODE_CONSTANTS.totalFontSize.normal);
    renderer.setFont('helvetica', 'bold');

    const currentFontSize = PERIOD_MODE_CONSTANTS.totalFontSize.normal;
    const textPadding = renderer.calculateBoldTextPadding(
      currentFontSize,
      PERIOD_MODE_CONSTANTS.boldTextPaddingMultiplier,
    );
    const { lines: totalLabelLines, startY: totalStartY } =
      renderer.drawTotalLabelLines(
        expensesTotal.label,
        margin,
        renderer.getY(),
        labelWidth,
        textPadding,
        lineSpacing,
      );

    const totalRowHeight = renderer.calculateRowHeight(
      totalLabelLines,
      lineHeight,
      lineSpacing,
    );

    const totalValue = renderer.formatCurrency(expensesTotal.value);
    const totalPercentage = this.calculatePercentage(expensesTotal.value);
    renderer.drawText(totalValue, margin + labelWidth, totalStartY, {
      align: 'right',
    });
    const percentageWidth = this.calculatePercentageWidth(renderer);
    if (totalPercentage) {
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.targetFontSize.normal);
      renderer.drawText(
        totalPercentage,
        margin + labelWidth + valueWidth + percentageWidth,
        totalStartY,
        {
          align: 'right',
        },
      );
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.totalFontSize.normal);
    }
    renderer.setY(totalStartY + totalRowHeight + sectionSpacing);
  }

  /**
   * Draw profit
   */
  private drawProfit(
    renderer: BaseRenderer,
    profit: { label: string; value: string } | null,
    targetPercentages?: TargetPercentages,
  ): void {
    if (!profit) return;

    const margin = renderer.getMargin();
    const pageHeight = renderer.getPageHeight();
    const labelWidth = this.calculateLabelWidth(renderer);
    const valueWidth = this.calculateValueWidth(renderer);
    const lineHeight = PERIOD_MODE_CONSTANTS.lineHeight;
    const tableEndX = this.calculateTableEndX(renderer);

    if (renderer.checkPageBreak(20)) {
      // Page break handled
    }

    renderer.moveDown(5);

    // Column headers
    const percentageWidth = this.calculatePercentageWidth(renderer);
    renderer.setFontSize(PERIOD_MODE_CONSTANTS.columnHeaderFontSize);
    renderer.setFont('helvetica', 'bold');
    renderer.drawText('CURRENT', margin + labelWidth, renderer.getY(), {
      align: 'right',
    });
    renderer.drawText(
      '% of Income',
      margin + labelWidth + valueWidth + percentageWidth,
      renderer.getY(),
      {
        align: 'right',
      },
    );
    renderer.moveDown(6);

    renderer.setFontSize(PERIOD_MODE_CONSTANTS.profitFontSize);
    renderer.setFont('helvetica', 'bold');
    const profitValue = renderer.formatCurrency(profit.value);
    const profitPercentage = this.calculatePercentage(profit.value);
    renderer.drawText(profit.label, margin, renderer.getY());
    renderer.drawText(profitValue, margin + labelWidth, renderer.getY(), {
      align: 'right',
    });
    if (profitPercentage) {
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.totalFontSize.important);
      renderer.drawText(
        profitPercentage,
        margin + labelWidth + valueWidth + percentageWidth,
        renderer.getY(),
        {
          align: 'right',
        },
      );
      renderer.setFontSize(PERIOD_MODE_CONSTANTS.profitFontSize);
    }

    // Draw target percentage if available
    if (targetPercentages?.profit !== undefined) {
      const targetX = margin + labelWidth + valueWidth + percentageWidth;
      const targetY = renderer.getY() + 3;
      renderer.drawTargetPercentage(
        targetPercentages.profit,
        targetX,
        targetY,
        PERIOD_MODE_CONSTANTS.targetFontSize.profit,
      );
    }
  }

  /**
   * Calculate table end X position
   * Table ends at the right edge of the percentage column
   */
  private calculateTableEndX(renderer: BaseRenderer): number {
    const margin = renderer.getMargin();
    const labelWidth = this.calculateLabelWidth(renderer);
    const valueWidth = this.calculateValueWidth(renderer);
    const percentageWidth = this.calculatePercentageWidth(renderer);
    // Table ends at the right edge of percentage column
    return margin + labelWidth + valueWidth + percentageWidth;
  }

  /**
   * Calculate label width
   */
  private calculateLabelWidth(renderer: BaseRenderer): number {
    const pageWidth = renderer.getPageWidth();
    const margin = renderer.getMargin();
    const availableWidth = pageWidth - 2 * margin;
    return availableWidth * PERIOD_MODE_CONSTANTS.labelWidthRatio;
  }

  /**
   * Calculate value width
   */
  private calculateValueWidth(renderer: BaseRenderer): number {
    const pageWidth = renderer.getPageWidth();
    const margin = renderer.getMargin();
    const availableWidth = pageWidth - 2 * margin;
    return availableWidth * PERIOD_MODE_CONSTANTS.valueWidthRatio;
  }

  /**
   * Calculate percentage width
   */
  private calculatePercentageWidth(renderer: BaseRenderer): number {
    const pageWidth = renderer.getPageWidth();
    const margin = renderer.getMargin();
    const availableWidth = pageWidth - 2 * margin;
    return availableWidth * PERIOD_MODE_CONSTANTS.percentageWidthRatio;
  }

  /**
   * Render the complete PDF report (Strategy interface implementation)
   */
  render(
    renderer: BaseRenderer,
    parsedData: PeriodReportData,
    targetPercentages?: TargetPercentages,
  ): void {
    // Set income total for percentage calculations
    this.incomeTotal = parsedData.income?.total?.value
      ? parseFloat(parsedData.income.total.value)
      : 0;

    // Draw Income
    this.drawSection(renderer, parsedData.income);

    // Draw Cost of Sales with target percentage
    this.drawSection(
      renderer,
      parsedData.costOfSales,
      true,
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
