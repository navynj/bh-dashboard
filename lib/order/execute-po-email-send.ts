import { prisma } from '@/lib/core/prisma';
import { sendPoEmail } from '@/lib/order/send-po-email';
import { getPoEmailOutboundSettings } from '@/lib/order/po-email-settings';
import type { PoPdfInput } from '@/features/order/office/utils/purchase-order-pdf';
import { buildPoPdfBuffer } from '@/features/order/office/utils/purchase-order-pdf';
import { parseSupplierOrderChannelPayload } from '@/lib/order/supplier-order-channel';
import type { EmailOrderChannelPayload, SupplierEmailContact } from '@/lib/order/supplier-order-channel';

type PoAddress = {
  address1: string;
  address2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

function toAddrLines(json: unknown): string[] {
  if (!json || typeof json !== 'object') return [];
  const a = json as PoAddress;
  if (!a.address1?.trim()) return [];
  const line1 = [a.address1.trim(), a.address2?.trim()].filter(Boolean).join(', ');
  const cityLine = [a.city?.trim(), a.province?.trim(), a.postalCode?.trim()].filter(Boolean).join(' ');
  const country = a.country?.trim() || '';
  return [line1, cityLine, country].filter(Boolean);
}

function dateToYmd(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Loads PO, sends outbound PO email to each supplier contact, updates `emailSentAt`.
 * Intended for `after()` / background execution — callers validate auth before enqueueing.
 */
export async function executePurchaseOrderOutboundEmailSend(
  purchaseOrderId: string,
): Promise<{ recipientCount: number }> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      supplier: true,
      lineItems: {
        orderBy: { sequence: 'asc' },
        include: { shopifyOrderLineItem: true },
      },
      shopifyOrders: {
        include: { customer: true },
      },
    },
  });

  if (!po) {
    throw new Error(`Purchase order not found: ${purchaseOrderId}`);
  }

  const channelPayload = parseSupplierOrderChannelPayload(
    (po.supplier.orderChannelType ?? 'email') as 'email' | 'order_link' | 'direct_instruction',
    po.supplier.orderChannelPayload,
  );

  let contacts: SupplierEmailContact[] = [];
  let supplierCcEmails: string[] = [];
  if (channelPayload.success && po.supplier.orderChannelType === 'email') {
    const ep = channelPayload.data as EmailOrderChannelPayload;
    contacts = ep.contacts;
    supplierCcEmails = ep.ccEmails;
  }

  if (contacts.length === 0 && po.supplier.contactEmails.length > 0) {
    contacts = po.supplier.contactEmails.map((email, i) => ({
      email,
      name: i === 0 ? (po.supplier.contactName ?? null) : null,
    }));
  }

  if (contacts.length === 0) {
    throw new Error('No email contacts configured for this supplier.');
  }

  const orderById = new Map(po.shopifyOrders.map((o) => [o.id, o]));
  const firstOrder = po.shopifyOrders[0];

  const linkedShopifyOrderNames = [
    ...new Set(po.shopifyOrders.map((o) => o.name.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const lineItems = po.lineItems.map((li) => {
    const soli = li.shopifyOrderLineItem;
    const srcOrder = soli ? orderById.get(soli.orderId) : undefined;
    const orderName = srcOrder?.name ?? firstOrder?.name ?? '—';
    const title = li.productTitle ?? '(untitled)';
    const description = li.variantTitle ? `${title} — ${li.variantTitle}` : title;
    const supplierRef = (li.supplierRef?.trim() || li.sku?.trim() || '—').slice(0, 40);
    return {
      shopifyOrderNumber: orderName,
      description,
      supplierRef,
      quantity: li.quantity,
      note: li.note?.trim() ?? '',
    };
  });

  const customerHeadline =
    po.shopifyOrders[0]?.customer?.company?.trim() ||
    po.shopifyOrders[0]?.customer?.displayName?.trim() ||
    null;

  const billingAddr = po.billingSameAsShipping
    ? po.shippingAddress
    : (po.billingAddress ?? po.shippingAddress);

  const pdfInput: PoPdfInput = {
    poNumber: po.poNumber,
    linkedShopifyOrderNames,
    dateCreated: dateToYmd(po.dateCreated),
    expectedDate: dateToYmd(po.expectedDate),
    customerHeadline,
    billingAddressLines: toAddrLines(billingAddr),
    shippingAddressLines: toAddrLines(po.shippingAddress),
    supplierCompany: po.supplier.company,
    lineItems,
  };

  const outbound = await getPoEmailOutboundSettings(prisma);
  const pdfBuffer = buildPoPdfBuffer(pdfInput);
  const sentAt = new Date();

  await prisma.poEmailDelivery.deleteMany({ where: { purchaseOrderId } });

  const deliveryTokens: string[] = [];
  const allPrimaryToLower = new Set(
    contacts.map((c) => c.email.trim().toLowerCase()).filter(Boolean),
  );
  for (const contact of contacts) {
    const token = crypto.randomUUID();
    deliveryTokens.push(token);
    await prisma.poEmailDelivery.create({
      data: {
        purchaseOrderId,
        recipientEmail: contact.email,
        recipientName: contact.name ?? null,
        trackingToken: token,
        sentAt,
      },
    });
    await sendPoEmail({
      to: [contact],
      supplierName: contact.name ?? po.supplier.company,
      pdfInput,
      outbound,
      trackingToken: token,
      pdfBuffer,
      supplierCcEmails,
      dedicatedToRecipientsLower: allPrimaryToLower,
    });
  }

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      emailSentAt: sentAt,
      emailTrackingToken: deliveryTokens[0] ?? null,
      emailOpenedAt: null,
      emailDeliveryWaivedAt: null,
    },
  });

  return { recipientCount: contacts.length };
}
