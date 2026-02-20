'use client';

import { useCallback, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { FileDown, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Report } from '@/lib/report/types';

interface ReportTableProps {
  reports: Report[];
  isLoading?: boolean;
  isOfficeOrAdmin?: boolean;
}

export function ReportTable({
  reports,
  isLoading = false,
  isOfficeOrAdmin = false,
}: ReportTableProps) {
  const [downloadingPdf, setDownloadingPdf] = useState<Set<string>>(new Set());

  const handleDownloadPDF = useCallback(async (reportId: string) => {
    setDownloadingPdf((prev) => new Set(prev).add(reportId));
    try {
      const res = await fetch(`/api/report/${reportId}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.details || 'Download failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const name = match?.[1] ?? `P&L_Report_${reportId}.pdf`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to download PDF');
    } finally {
      setDownloadingPdf((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  }, []);

  const handleViewPDF = useCallback((reportId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    window.open(`${origin}/api/report/${reportId}/pdf?inline=1`, '_blank');
  }, []);
  const columns: ColumnDef<Report>[] = [
    {
      accessorKey: 'isMonthly',
      header: 'Type',
      cell: ({ row }) => {
        return row.original.isMonthly ? 'Monthly' : 'Period';
      },
    },
    {
      accessorKey: 'startDate',
      header: 'Start Date',
      cell: ({ row }) => {
        // Parse date string directly to avoid timezone issues
        // Notion returns dates in "YYYY-MM-DD" format
        const dateStr = row.original.startDate;
        if (!dateStr) return '-';

        // Parse "YYYY-MM-DD" format directly
        const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1; // JavaScript months are 0-indexed
          const day = parseInt(dateMatch[3], 10);
          const date = new Date(year, month, day);
          return format(date, 'MMM dd, yyyy');
        }

        // Fallback to original parsing if format is different
        const date = new Date(dateStr);
        return format(date, 'MMM dd, yyyy');
      },
    },
    {
      accessorKey: 'endDate',
      header: 'End Date',
      cell: ({ row }) => {
        // Parse date string directly to avoid timezone issues
        // Notion returns dates in "YYYY-MM-DD" format
        const dateStr = row.original.endDate;
        if (!dateStr) return '-';

        // Parse "YYYY-MM-DD" format directly
        const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1; // JavaScript months are 0-indexed
          const day = parseInt(dateMatch[3], 10);
          const date = new Date(year, month, day);
          return format(date, 'MMM dd, yyyy');
        }

        // Fallback to original parsing if format is different
        const date = new Date(dateStr);
        return format(date, 'MMM dd, yyyy');
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return format(date, 'MMM dd, yyyy HH:mm');
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const report = row.original;
        const isDownloadingPdf = downloadingPdf.has(report.id);

        return (
          <div className="flex items-center gap-2">
            {report.notionUrl && isOfficeOrAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(report.notionUrl, '_blank')}
                disabled={isDownloadingPdf}
              >
                <ExternalLink className="h-4 w-4" />
                View in Notion
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewPDF(report.id)}
              disabled={isDownloadingPdf}
            >
              <FileText className="h-4 w-4" />
              View PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadPDF(report.id)}
              disabled={isDownloadingPdf}
              isLoading={isDownloadingPdf}
            >
              <FileDown className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Generated Reports</h2>
      <DataTable columns={columns} data={reports} isLoading={isLoading} />
    </div>
  );
}
