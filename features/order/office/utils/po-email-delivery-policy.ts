import type { SupplierOrderChannelType } from '@/lib/order/supplier-order-channel';

export function computeEmailDeliveryOutstanding(args: {
  supplierOrderChannelType: SupplierOrderChannelType;
  emailSentAt: Date | null | undefined;
  archivedAt: Date | null | undefined;
  /** CSV / legacy import POs — do not require logged supplier email. */
  legacyExternalId: number | null | undefined;
  /** User marked "do not send" — no outstanding nag until cleared or email is logged. */
  emailDeliveryWaivedAt: Date | null | undefined;
}): boolean {
  if (args.archivedAt) return false;
  if (args.legacyExternalId != null) return false;
  if (args.supplierOrderChannelType !== 'email') return false;
  if (args.emailDeliveryWaivedAt != null) return false;
  return args.emailSentAt == null;
}
