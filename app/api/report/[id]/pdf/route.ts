import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getReportFromNotionById,
  normalizeNotionId,
} from '@/lib/report/notion/reports';
import { generatePDFFromReportData } from '@/lib/report/pdf';
import type { ReportData } from '@/lib/report/pdf/types';
import {
  withValidTokenForLocation,
  fetchProfitAndLossReportFromQb,
} from '@/lib/quickbooks';
import { prisma } from '@/lib/core/prisma';

/**
 * GET /api/report/[id]/pdf
 * Generate and return P&L report PDF (report metadata from Notion, P&L data from QuickBooks).
 * Query: ?inline=1 — open in browser (Content-Disposition: inline); otherwise attachment (download).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const { id } = await params;

    // Normalize Notion ID (remove hyphens if present)
    // Notion API accepts both formats, but we normalize for consistency
    const normalizedId = normalizeNotionId(id) || id;

    // Get report from Notion - try normalized ID first, then original if different
    let report = await getReportFromNotionById(normalizedId, userId);

    // If normalized ID failed and it's different from original, try original format
    if (!report && normalizedId !== id) {
      report = await getReportFromNotionById(id, userId);
    }

    if (!report) {
      return NextResponse.json(
        {
          error: 'Report not found',
          details: `Report with ID ${id} not found. Please verify the report exists in Notion.`,
        },
        { status: 404 },
      );
    }

    // Fetch report from QuickBooks
    // For monthly reports, use summarize_column_by=Month to get monthly columns
    const isMonthly =
      report.isMonthly || (report.months && report.months.length > 0);

    const location = await prisma.location.findUnique({
      where: { code: report.locationCode },
      select: { id: true, name: true },
    });
    if (!location) {
      return NextResponse.json(
        {
          error: 'Location not found',
          details: `No location found for code "${report.locationCode}".`,
        },
        { status: 404 },
      );
    }

    const reportData = await withValidTokenForLocation(
      location.id,
      (accessToken, realmId, classId) =>
        fetchProfitAndLossReportFromQb(
          realmId,
          report.startDate,
          report.endDate,
          'Accrual',
          accessToken,
          classId,
          isMonthly ? 'Month' : undefined,
        ),
    );

    const locationName = location.name ?? null;

    // Generate PDF (QuickBooks raw shape is compatible with ReportData)
    const pdfBytes = generatePDFFromReportData(
      reportData as ReportData,
      report.startDate,
      report.endDate,
      locationName,
      report.targetPercentages,
    );

    // Build PDF filename with location code and monthly indicator
    const locationPrefix = report.locationCode ? `${report.locationCode}_` : '';
    const monthlyPrefix = report.isMonthly ? 'Monthly_' : '';
    const pdfFileName = `${locationPrefix}${monthlyPrefix}P&L_Report_${report.startDate}_${report.endDate}.pdf`;

    const { searchParams } = new URL(request.url);
    const inline = searchParams.get('inline') === '1';

    const pdfBuffer = Buffer.from(pdfBytes);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': inline
          ? `inline; filename="${pdfFileName}"`
          : `attachment; filename="${pdfFileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}
