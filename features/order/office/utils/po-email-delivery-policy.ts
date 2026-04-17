import type { SupplierOrderChannelType } from '@/lib/order/supplier-order-channel';

export function computeEmailDeliveryOutstanding(args: {
  supplierOrderChannelType: SupplierOrderChannelType;
  emailSentAt: Date | null | undefined;
  archivedAt: Date | null | undefined;
  /** CSV / legacy import POs — do not require logged supplier email. */
  legacyExternalId: number | null | undefined;
}): boolean {
  if (args.archivedAt) return false;
  if (args.legacyExternalId != null) return false;
  if (args.supplierOrderChannelType !== 'email') return false;
  return args.emailSentAt == null;
}
