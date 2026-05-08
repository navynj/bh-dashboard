import { requireOrderManager } from '@/lib/api/require-order-manager';
import { toApiErrorResponse } from '@/lib/core/errors';
import { prisma } from '@/lib/core/prisma';
import { executePurchaseOrderOutboundEmailSend } from '@/lib/order/execute-po-email-send';
import type {
  EmailOrderChannelPayload,
  SupplierEmailContact,
} from '@/lib/order/supplier-order-channel';
import { parseSupplierOrderChannelPayload } from '@/lib/order/supplier-order-channel';
import { after, NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const gate = await requireOrderManager();
    if (!gate.ok) return gate.response;

    const { id } = await context.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 },
      );
    }

    if (!po.supplier) {
      return NextResponse.json(
        { error: 'This purchase order has no supplier and cannot be emailed.' },
        { status: 422 },
      );
    }
    const supplier = po.supplier;

    const channelPayload = parseSupplierOrderChannelPayload(
      (supplier.orderChannelType ?? 'email') as
        | 'email'
        | 'order_link'
        | 'direct_instruction',
      supplier.orderChannelPayload,
    );

    let contacts: SupplierEmailContact[] = [];
    if (channelPayload.success && supplier.orderChannelType === 'email') {
      const ep = channelPayload.data as EmailOrderChannelPayload;
      contacts = ep.contacts;
    }

    if (contacts.length === 0 && supplier.contactEmails.length > 0) {
      contacts = supplier.contactEmails.map((email, i) => ({
        email,
        name: i === 0 ? (supplier.contactName ?? null) : null,
      }));
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'No email contacts configured for this supplier.' },
        { status: 422 },
      );
    }

    const baselineEmailSentAt = po.emailSentAt?.toISOString() ?? null;
    const recipientCount = contacts.length;
    const poNumber = po.poNumber;
    const poId = id;

    after(async () => {
      try {
        await executePurchaseOrderOutboundEmailSend(poId);
      } catch (err) {
        console.error(
          '[POST /api/order/purchase-orders/[id]/send-email] background send failed:',
          err,
        );
      }
    });

    return NextResponse.json(
      {
        ok: true,
        queued: true,
        purchaseOrderId: poId,
        poNumber,
        baselineEmailSentAt,
        recipientCount,
      },
      {
        status: 202,
      },
    );
  } catch (err: unknown) {
    return toApiErrorResponse(
      err,
      'POST /api/order/purchase-orders/[id]/send-email error:',
    );
  }
}
