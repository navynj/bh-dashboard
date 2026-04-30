import { legacyFallbackOrderChannel } from '@/lib/order/supplier-order-channel';
import type { EmailOrderChannelPayload } from '@/lib/order/supplier-order-channel';

/** Supplier row fields needed to match outbound PO email recipient resolution. */
export type SupplierScalarForPoEmailRecipients = {
  orderChannelType: string;
  orderChannelPayload: unknown;
  contactEmails: string[];
  contactName: string | null;
  link: string | null;
  notes: string | null;
};

/** Count of primary TO contacts used when sending PO email (same rules as `execute-po-email-send`). */
export function expectedPoEmailRecipientCount(
  supplier: SupplierScalarForPoEmailRecipients,
): number {
  const ch = legacyFallbackOrderChannel({
    orderChannelType: supplier.orderChannelType,
    orderChannelPayload: supplier.orderChannelPayload,
    contactEmails: supplier.contactEmails,
    contactName: supplier.contactName,
    link: supplier.link,
    notes: supplier.notes,
  });
  if (ch.type !== 'email') return 0;
  return (ch.payload as EmailOrderChannelPayload).contacts.length;
}
