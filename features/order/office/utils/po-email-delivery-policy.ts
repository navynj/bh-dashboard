import type { SupplierOrderChannelType } from '@/lib/order/supplier-order-channel';
import type { PurchaseOrderStatus } from '../types/purchase-order';

export function computeEmailDeliveryOutstanding(args: {
  supplierOrderChannelType: SupplierOrderChannelType;
  emailSentAt: Date | null | undefined;
  archivedAt: Date | null | undefined;
  /** CSV / legacy import POs — do not require logged supplier email. */
  legacyExternalId: number | null | undefined;
  /** User marked "do not send" — no outstanding nag until cleared or email is logged. */
  emailDeliveryWaivedAt: Date | null | undefined;
  /** Hub “on hold” — suppress email delivery reminders. */
  purchaseOrderStatus?: PurchaseOrderStatus | null;
}): boolean {
  if (args.purchaseOrderStatus === 'pending') return false;
  if (args.archivedAt) return false;
  if (args.legacyExternalId != null) return false;
  if (args.supplierOrderChannelType !== 'email') return false;
  if (args.emailDeliveryWaivedAt != null) return false;
  return args.emailSentAt == null;
}
