'use client';

import { useState } from 'react';
import { ExternalLink, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatVancouverOrderedSidebar } from '../utils/vancouver-datetime';
import { postSendPurchaseOrderEmail } from '../utils/post-send-po-email';
import type { SupplierEntry, PoEmailDeliveryItem } from '../types';

type Props = {
  entry: SupplierEntry;
  /** PO created and not on draft-only selection: show send + per-recipient email UI. */
  includePoEmailTools?: boolean;
  /** Selected PO outbound email timestamp (ISO) when recorded. */
  poEmailSentAt?: string | null;
  /** Selected PO still needs a logged supplier email under the office policy. */
  poEmailDeliveryOutstanding?: boolean;
  /** Selected PO id for send-email API (omit when drafts or none). */
  selectedPoBlockId?: string | null;
  /** Per-recipient delivery records for the selected PO. */
  emailDeliveries?: PoEmailDeliveryItem[];
  onPoEmailSent?: (poId: string) => void;
  onSendEmailComplete?: () => void;
  /** Line items are being lazy-loaded — disable email send. */
  lineItemsLoading?: boolean;
};

/** UI-only placeholder until outbound email events are wired. */
type EmailDeliveryUiStatus =
  | 'not_sent'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed';

const EMAIL_STATUS_META: Record<
  EmailDeliveryUiStatus,
  { label: string; variant: 'secondary' | 'outline' | 'blue' | 'green' | 'red' }
> = {
  not_sent: { label: 'Not sent', variant: 'secondary' },
  queued: { label: 'Queued', variant: 'outline' },
  sent: { label: 'Sent', variant: 'blue' },
  delivered: { label: 'Delivered', variant: 'green' },
  failed: { label: 'Failed', variant: 'red' },
};

function InstructionsBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2.5">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
        {title}
      </div>
      <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
        {children}
      </div>
    </div>
  );
}

export function OrderProcessingBlock({
  entry,
  includePoEmailTools = true,
  poEmailSentAt = null,
  poEmailDeliveryOutstanding = false,
  selectedPoBlockId = null,
  emailDeliveries = [],
  onPoEmailSent,
  onSendEmailComplete,
  lineItemsLoading = false,
}: Props) {
  const t = entry.supplierOrderChannelType;
  const contacts = entry.supplierPoContacts;
  const savedInstruction = entry.supplierOrderInstruction?.trim() ?? '';
  const [sendingEmail, setSendingEmail] = useState(false);

  const deliveryByEmail = new Map(emailDeliveries.map((d) => [d.recipientEmail.toLowerCase(), d]));

  const performSendEmail = async () => {
    if (
      !selectedPoBlockId ||
      selectedPoBlockId === '__drafts__' ||
      contacts.length === 0
    ) {
      return;
    }
    setSendingEmail(true);
    try {
      const result = await postSendPurchaseOrderEmail(selectedPoBlockId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onPoEmailSent?.(selectedPoBlockId);
      onSendEmailComplete?.();
      if (result.recipientCount > 0) {
        toast.success(
          `Email sent to ${result.recipientCount} contact${result.recipientCount === 1 ? '' : 's'}.`,
        );
      } else {
        toast.success('PO email sent.');
      }
    } catch {
      toast.error('Network error — could not send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendEmailClick = () => {
    if (
      !selectedPoBlockId ||
      selectedPoBlockId === '__drafts__' ||
      contacts.length === 0
    ) {
      return;
    }
    if (poEmailSentAt) {
      toast('Resend PO email to all contacts?', {
        description:
          'The same PO PDF will be emailed again to every address on file for this supplier.',
        action: {
          label: 'Resend',
          onClick: () => {
            void performSendEmail();
          },
        },
        cancel: {
          label: 'Cancel',
          onClick: () => {},
        },
      });
      return;
    }
    void performSendEmail();
  };

  return (
    <div className="flex-shrink-0 border-b bg-muted/15 px-4 py-3">
      <div
        className={
          t === 'email' && includePoEmailTools
            ? 'mb-2.5 flex items-start justify-between gap-3'
            : 'mb-2.5 flex items-start gap-2'
        }
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="mt-0.5 shrink-0 rounded-md border bg-background p-1 text-muted-foreground">
            <Mail className="size-3.5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-medium text-foreground leading-tight">
              Order processing
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {t === 'email' && includePoEmailTools ? (
                <>
                  One outbound message to every address on file for this supplier.
                  {poEmailSentAt ? (
                    <>
                      {' '}
                      Last send logged{' '}
                      <span className="font-medium text-foreground/80">
                        {formatVancouverOrderedSidebar(poEmailSentAt)}
                      </span>
                      .
                    </>
                  ) : poEmailDeliveryOutstanding ? (
                    <>
                      {' '}
                      <span className="font-medium text-destructive">
                        No send logged for this PO yet.
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  How to place this PO with the supplier. Delivery states below are
                  preview UI only.
                </>
              )}
            </p>
          </div>
        </div>
        {t === 'email' && includePoEmailTools ? (
          <Button
            type="button"
            size="sm"
            className={
              poEmailSentAt
                ? 'h-8 shrink-0 text-[11px] rounded-md gap-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-800 dark:hover:bg-emerald-950/60'
                : 'h-8 shrink-0 text-[11px] rounded-md gap-1.5 border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white dark:border-emerald-500'
            }
            variant="outline"
            disabled={
              contacts.length === 0 ||
              !selectedPoBlockId ||
              selectedPoBlockId === '__drafts__' ||
              sendingEmail ||
              lineItemsLoading
            }
            onClick={() => handleSendEmailClick()}
          >
            <Mail className="size-3.5" aria-hidden />
            {sendingEmail
              ? 'Sending…'
              : poEmailSentAt
                ? 'Email sent - resend?'
                : 'Send email to all contacts'}
          </Button>
        ) : null}
      </div>

      {t === 'email' ? (
        <div className="flex flex-col gap-2.5">
          {savedInstruction ? (
            <InstructionsBox title="Instructions">
              <p className="whitespace-pre-wrap">{savedInstruction}</p>
            </InstructionsBox>
          ) : null}

          {includePoEmailTools ? (
            <div className="rounded-md border bg-background">
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/25">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Per-email delivery
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {contacts.length} recipient{contacts.length === 1 ? '' : 's'}
                </span>
              </div>
              {contacts.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-muted-foreground">
                  No PO email contacts on file. Add addresses in supplier settings
                  to send from the hub.
                </div>
              ) : (
                <ul className="divide-y">
                  {contacts.map((c, i) => {
                    const delivery = deliveryByEmail.get(c.email.toLowerCase());
                    const label = [c.name?.trim(), c.email]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <li
                        key={`${c.email}-${i}`}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <span className="min-w-0 text-[11px] text-foreground truncate">
                          {label}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {delivery ? (
                            <>
                              <span className="text-[9px] text-muted-foreground">
                                Sent {formatVancouverOrderedSidebar(delivery.sentAt)}
                              </span>
                              {delivery.openedAt ? (
                                <Badge
                                  variant="green"
                                  className="rounded px-1.5 text-[9px]"
                                >
                                  Opened
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="rounded px-1.5 text-[9px] bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  Unread
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge
                              variant={EMAIL_STATUS_META['not_sent'].variant}
                              className="rounded px-1.5 text-[9px]"
                            >
                              {EMAIL_STATUS_META['not_sent'].label}
                            </Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      ) : t === 'order_link' ? (
        <div className="flex flex-col gap-2.5">
          {savedInstruction ? (
            <InstructionsBox title="Instructions">
              <p className="whitespace-pre-wrap">{savedInstruction}</p>
            </InstructionsBox>
          ) : null}
          <div className="rounded-md border bg-background px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Order link
              </div>
              {entry.supplierOrderUrl ? (
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" asChild>
                  <a
                    href={entry.supplierOrderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-3" aria-hidden />
                    Open in new tab
                  </a>
                </Button>
              ) : null}
            </div>
            {entry.supplierOrderUrl ? (
              <a
                href={entry.supplierOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-600 hover:underline break-all"
              >
                {entry.supplierOrderUrl}
              </a>
            ) : (
              <span className="text-[11px] text-muted-foreground">—</span>
            )}
          </div>
          {entry.supplierInvoiceConfirmSenderEmail ? (
            <p className="text-[10px] text-muted-foreground">
              Invoice confirmations expected from{' '}
              <span className="font-mono text-foreground/90">
                {entry.supplierInvoiceConfirmSenderEmail}
              </span>
              .
            </p>
          ) : null}
        </div>
      ) : (
        savedInstruction && (
          <div className="flex flex-col gap-2.5">
            <InstructionsBox title="Instructions">
              <p className="whitespace-pre-wrap">{savedInstruction}</p>
            </InstructionsBox>
          </div>
        )
      )}
    </div>
  );
}
