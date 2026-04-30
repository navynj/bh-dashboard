import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  parseBody,
  shopifyOrderCreateBodySchema,
  type ShopifyOrderCreateBody,
} from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import { getShopifyAdminEnv, isShopifyAdminEnvConfigured } from '@/lib/shopify/env';
import { createShopifyOrder } from '@/lib/shopify/createShopifyOrder';
import type {
  CreateShopifyOrderMailingInput,
  CreateShopifyOrderParams,
} from '@/lib/shopify/createShopifyOrder';
import { fetchShopifyOrderNodeByGid } from '@/lib/shopify/fetchOrders';
import { syncOneOrder } from '@/lib/shopify/sync/upsert-order';

function trimOrUndef(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t && t.length > 0 ? t : undefined;
}

function mailingFromBody(
  row: ShopifyOrderCreateBody['shippingAddress'],
): CreateShopifyOrderMailingInput {
  return {
    address1: row.address1.trim(),
    address2: row.address2?.trim() || undefined,
    city: row.city.trim(),
    zip: row.zip.trim(),
    countryCode: row.countryCode,
    provinceCode: trimOrUndef(row.provinceCode),
    company: trimOrUndef(row.company),
    phone: trimOrUndef(row.phone),
    firstName: trimOrUndef(row.firstName),
    lastName: trimOrUndef(row.lastName),
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    if (!isShopifyAdminEnvConfigured()) {
      return NextResponse.json(
        { error: 'Shopify Admin API is not configured on the server.' },
        { status: 503 },
      );
    }

    const parsed = await parseBody(request, shopifyOrderCreateBodySchema);
    if ('error' in parsed) return parsed.error;
    const body = parsed.data;

    const creds = getShopifyAdminEnv();

    const params: CreateShopifyOrderParams = {
      customerShopifyGid: body.customerShopifyGid,
      shippingAddress: mailingFromBody(body.shippingAddress),
      billingAddress: body.billingAddress
        ? mailingFromBody(body.billingAddress)
        : undefined,
      lineItems: body.lineItems.map((li) =>
        li.kind === 'variant'
          ? { kind: 'variant', variantGid: li.variantGid, quantity: li.quantity }
          : {
              kind: 'custom',
              title: li.title,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
            },
      ),
      deliveryMethod: body.deliveryMethod,
      shippingFee: body.shippingFee,
      financialStatus: body.financialStatus,
      note: body.note ?? null,
    };

    const { orderGid } = await createShopifyOrder(creds, params);

    const node = await fetchShopifyOrderNodeByGid(creds, orderGid, {
      lineItems: 'sync',
    });
    if (!node) {
      return NextResponse.json(
        {
          error:
            'Order was created in Shopify but could not be loaded for sync. Run a Shopify sync.',
        },
        { status: 502 },
      );
    }

    const synced = await syncOneOrder(node);

    return NextResponse.json({
      ok: true,
      shopifyOrderId: synced.id,
      shopifyGid: synced.shopifyGid,
      name: node.name ?? null,
    });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'POST /api/order-office/shopify-orders/create');
  }
}
