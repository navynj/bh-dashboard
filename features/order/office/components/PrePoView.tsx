import { OrderBlock } from './OrderBlock';
import type { PreViewData } from '../types';

export type SeparatePoPayload = {
  expectedDate: string | null;
  comment: string | null;
  shopifyOrderNumber: string;
  lineItems: {
    sku: string | null;
    productTitle: string;
    quantity: number;
    itemPrice: number | null;
  }[];
};

type Props = {
  viewData: PreViewData;
  inclusions?: Record<string, boolean[]>;
  onToggleInclude?: (orderId: string, itemIdx: number) => void;
  onSeparatePo?: (payload: SeparatePoPayload) => void;
  /** Archive only this order (Separate PO dialog), not every draft in the row. */
  onArchiveShopifyOrder?: (shopifyOrderDbId: string) => void;
  showArchived?: boolean;
  onUnarchiveShopifyOrder?: (shopifyOrderDbId: string) => void;
  /** When editing drafts under a PO tab, pass PO id for Shopify save + resync. */
  purchaseOrderId?: string | null;
};

export function PrePoView({
  viewData,
  inclusions,
  onToggleInclude,
  onSeparatePo,
  onArchiveShopifyOrder,
  showArchived,
  onUnarchiveShopifyOrder,
  purchaseOrderId,
}: Props) {
  const orders =
    showArchived === true
      ? viewData.shopifyOrderDrafts
      : viewData.shopifyOrderDrafts.filter((o) => !o.archivedAt);

  return (
    <div>
      {orders.map((order) => (
        <OrderBlock
          key={order.id}
          order={order}
          inclusions={inclusions?.[order.id]}
          onToggleInclude={onToggleInclude}
          onSeparatePo={showArchived ? undefined : onSeparatePo}
          onArchiveShopifyOrder={onArchiveShopifyOrder}
          showArchived={showArchived}
          onUnarchiveShopifyOrder={onUnarchiveShopifyOrder}
          purchaseOrderId={purchaseOrderId ?? undefined}
        />
      ))}
    </div>
  );
}
