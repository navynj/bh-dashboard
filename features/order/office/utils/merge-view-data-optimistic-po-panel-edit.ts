import type {
  ViewData,
  OfficePurchaseOrderBlock,
  PoPanelMeta,
  PoDeliveryLocationPresetSummary,
} from '../types';

/**
 * Fields we optimistically mirror on `OfficePurchaseOrderBlock` / `panelMeta`
 * after MetaPanel “Save changes” (PUT purchase order) until `router.refresh()`.
 */
export type OptimisticPoPanelEditPatch = Partial<
  Pick<
    PoPanelMeta,
    | 'comment'
    | 'expectedDate'
    | 'shippingAddress'
    | 'billingAddress'
    | 'billingSameAsShipping'
    | 'poNumber'
    | 'deliveryLocationPreset'
  >
>;

type EditPoLikeFields = {
  expectedDate?: string | null;
  comment?: string | null;
  poNumber?: string;
  shippingAddress?: PoPanelMeta['shippingAddress'];
  billingAddress?: PoPanelMeta['billingAddress'];
  billingSameAsShipping?: boolean;
  deliveryLocationPresetId?: string | null;
  status?: unknown;
};

/**
 * Maps a PUT body fragment to a shallow `panelMeta` patch. Omits `status`
 * (handled by {@link mergeViewDataWithOptimisticPoHubStatus}).
 */
export function panelPatchFromEditPoFields(
  fields: EditPoLikeFields,
): OptimisticPoPanelEditPatch | null {
  const p: OptimisticPoPanelEditPatch = {};
  if (fields.expectedDate !== undefined) {
    p.expectedDate = fields.expectedDate;
  }
  if (fields.comment !== undefined) {
    p.comment = fields.comment;
  }
  if (fields.poNumber !== undefined) {
    p.poNumber = fields.poNumber;
  }
  if (fields.shippingAddress !== undefined) {
    p.shippingAddress = fields.shippingAddress;
  }
  if (fields.billingAddress !== undefined) {
    p.billingAddress = fields.billingAddress;
  }
  if (fields.billingSameAsShipping !== undefined) {
    p.billingSameAsShipping = fields.billingSameAsShipping;
  }
  if (fields.deliveryLocationPresetId !== undefined) {
    if (fields.deliveryLocationPresetId === null) {
      p.deliveryLocationPreset = null;
    } else {
      const id = fields.deliveryLocationPresetId;
      p.deliveryLocationPreset = {
        id,
        name: 'Preset',
        locationCodes: [],
      } satisfies PoDeliveryLocationPresetSummary;
    }
  }
  return Object.keys(p).length > 0 ? p : null;
}

export function mergeViewDataWithOptimisticPoPanelEdits(
  viewDataMap: Record<string, ViewData>,
  patchByPoId: Record<string, OptimisticPoPanelEditPatch>,
): Record<string, ViewData> {
  const ids = Object.keys(patchByPoId);
  if (ids.length === 0) return viewDataMap;

  const out: Record<string, ViewData> = { ...viewDataMap };
  let any = false;

  for (const [supplierKey, vd] of Object.entries(viewDataMap)) {
    if (vd.type !== 'post') continue;
    let touched = false;
    const purchaseOrders = vd.purchaseOrders.map((po) => {
      const patch = patchByPoId[po.id];
      if (!patch || Object.keys(patch).length === 0) return po;

      touched = true;
      const nextPoNumber = patch.poNumber ?? po.poNumber;
      const panelMeta = po.panelMeta
        ? ({
            ...po.panelMeta,
            ...patch,
            poNumber: nextPoNumber,
          } satisfies PoPanelMeta)
        : po.panelMeta;

      const next: OfficePurchaseOrderBlock = {
        ...po,
        poNumber: nextPoNumber,
        panelMeta,
      };
      return next;
    });
    if (touched) {
      any = true;
      out[supplierKey] = { ...vd, purchaseOrders };
    }
  }

  return any ? out : viewDataMap;
}
