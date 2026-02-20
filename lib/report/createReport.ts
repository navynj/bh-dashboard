/**
 * Client-side helper to create a P&L report via the API.
 * Handles POST, success/error toasts, and optional onSuccess callback.
 */

export type ReportRequestBody =
  | {
      locationCode: string;
      months: Array<{ year: number; month: number }>;
      accountingMethod?: string;
      targetPercentages?: {
        costOfSales?: number;
        payroll?: number;
        profit?: number;
      };
    }
  | {
      locationCode: string;
      startDate: string;
      endDate: string;
      accountingMethod?: string;
      targetPercentages?: {
        costOfSales?: number;
        payroll?: number;
        profit?: number;
      };
    };

export async function createReport(
  body: ReportRequestBody,
  options?: { onSuccess?: () => void }
): Promise<void> {
  const res = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.details || 'Generate failed');
  }
  const { toast } = await import('sonner');
  toast.success('Report created and saved to Notion');
  options?.onSuccess?.();
}
