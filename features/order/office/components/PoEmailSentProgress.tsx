'use client';

import { cn } from '@/lib/utils/cn';

export type PoEmailSentProgressProps = {
  className?: string;
  /** Tighter layout for sidebar pills. */
  compact?: boolean;
  /** When false, render nothing — parent shows "—". */
  tracked: boolean;
  /** Logged `po_email_deliveries` rows (one per primary TO send). */
  deliveryCount: number;
  /** Expected primary TO count from supplier channel (0 = not configured). */
  expectedRecipientCount: number;
  /** `purchase_orders.email_sent_at` (ISO) when set. */
  emailSentAt: string | null;
  emailReplyReceivedAt?: string | null;
  /** Stronger "needs send" styling (outstanding / sidebar nag). */
  emphasizePending?: boolean;
};

/**
 * Email delivery progress for PO rows — table view + grouped sidebar.
 * Sent: emerald dots per logged delivery. Pending: hollow slots vs expected TOs + "Not sent".
 */
export function PoEmailSentProgress({
  tracked,
  deliveryCount,
  expectedRecipientCount,
  emailSentAt,
  emailReplyReceivedAt = null,
  emphasizePending = false,
  compact = false,
  className,
}: PoEmailSentProgressProps) {
  if (!tracked) return null;

  const sent = deliveryCount > 0 || Boolean(emailSentAt?.trim());
  const dot =
    compact ? 'inline-block w-1.5 h-1.5 rounded-sm' : 'inline-block w-2 h-2 rounded-sm';
  const gap = compact ? 'gap-0.5' : 'gap-0.5';

  if (sent) {
    const n = Math.max(deliveryCount, 1);
    return (
      <div
        className={cn('flex items-center gap-1.5 mt-px', className)}
      >
        <div className={cn('flex items-center', gap)}>
          {Array.from({ length: n }).map((_, i) => (
            <span key={i} className={cn(dot, 'bg-emerald-500')} />
          ))}
        </div>
        <span
          className={cn(
            'leading-none font-medium text-emerald-700',
            compact ? 'text-[7px]' : 'text-[8px]',
          )}
        >
          Sent{n > 1 ? ` ×${n}` : ''}
        </span>
        {expectedRecipientCount > 0 && n < expectedRecipientCount ? (
          <span
            className={cn(
              'leading-none font-medium text-amber-700',
              compact ? 'text-[7px]' : 'text-[8px]',
            )}
          >
            · {n}/{expectedRecipientCount}
          </span>
        ) : null}
        {emailReplyReceivedAt ? (
          <span
            className={cn(
              'leading-none font-medium text-blue-600',
              compact ? 'text-[7px]' : 'text-[8px]',
            )}
          >
            · Reply ✓
          </span>
        ) : null}
      </div>
    );
  }

  const slots = Math.max(expectedRecipientCount, 1);
  const pendingStrong = emphasizePending;

  return (
    <div className={cn('flex flex-col gap-0.5 mt-px', className)}>
      <div className="flex items-center gap-1.5">
        <div className={cn('flex items-center', gap)}>
          {Array.from({ length: slots }).map((_, i) => (
            <span
              key={i}
              className={cn(
                dot,
                'border bg-transparent',
                pendingStrong
                  ? 'border-destructive/70'
                  : 'border-amber-500/60',
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            'leading-none font-semibold',
            compact ? 'text-[7px]' : 'text-[8px]',
            pendingStrong ? 'text-destructive' : 'text-amber-800 dark:text-amber-200',
          )}
        >
          Not sent
        </span>
      </div>
      <div
        className={cn(
          'leading-none font-medium tabular-nums',
          compact ? 'text-[7px]' : 'text-[8px]',
          pendingStrong ? 'text-destructive/90' : 'text-muted-foreground',
        )}
      >
        {expectedRecipientCount > 0
          ? `0 / ${expectedRecipientCount} sent`
          : 'No contact emails'}
      </div>
    </div>
  );
}
