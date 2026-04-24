import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';
import { sendPoEmail } from '@/lib/order/send-po-email';
import { getPoEmailOutboundSettings } from '@/lib/order/po-email-settings';
import type { PoPdfInput } from '@/features/order/office/utils/purchase-order-pdf';
import { buildPoPdfBuffer } from '@/features/order/office/utils/purchase-order-pdf';
import { parseSupplierOrderChannelPayload } from '@/lib/order/supplier-order-channel';
import type { EmailOrderChannelPayload, SupplierEmailContact } from '@/lib/order/supplier-order-channel';

type RouteContext = { params: Promise<{ id: string }> };

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

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Office or admin access required' }, { status: 403 });
    }

    const { id } = await context.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
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
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    // ── Resolve supplier email contacts ────────────────────────────────────────

    const channelPayload = parseSupplierOrderChannelPayload(
      (po.supplier.orderChannelType ?? 'email') as 'email' | 'order_link' | 'direct_instruction',
      po.supplier.orderChannelPayload,
    );

    let contacts: SupplierEmailContact[] = [];
    if (channelPayload.success && po.supplier.orderChannelType === 'email') {
      contacts = (channelPayload.data as EmailOrderChannelPayload).contacts;
    }

    if (contacts.length === 0 && po.supplier.contactEmails.length > 0) {
      contacts = po.supplier.contactEmails.map((email, i) => ({
        email,
        name: i === 0 ? (po.supplier.contactName ?? null) : null,
      }));
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'No email contacts configured for this supplier.' },
        { status: 422 },
      );
    }

    // ── Build PDF input ────────────────────────────────────────────────────────

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

    // ── Build PDF once, send one email per recipient ───────────────────────────

    const outbound = await getPoEmailOutboundSettings(prisma);
    const pdfBuffer = buildPoPdfBuffer(pdfInput);
    const sentAt = new Date();

    // Delete previous delivery records for this PO so we always have fresh data
    await prisma.poEmailDelivery.deleteMany({ where: { purchaseOrderId: id } });

    const deliveryTokens: string[] = [];
    for (const contact of contacts) {
      const token = crypto.randomUUID();
      deliveryTokens.push(token);
      await prisma.poEmailDelivery.create({
        data: {
          purchaseOrderId: id,
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
      });
    }

    // ── Mark as sent ───────────────────────────────────────────────────────────

    await prisma.purchaseOrder.update({
      where: { id },
      data: {
        emailSentAt: sentAt,
        emailTrackingToken: deliveryTokens[0] ?? null,
        emailOpenedAt: null,
      },
    });

    return NextResponse.json({ ok: true, recipientCount: contacts.length });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'POST /api/purchase-orders/[id]/send-email error:');
  }
}
