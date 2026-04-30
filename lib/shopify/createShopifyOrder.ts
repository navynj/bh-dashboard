/**
 * Create a real Shopify order via Admin `orderCreate` (not Draft Order).
 * Requires `write_orders` on the Admin API token.
 */

import { createAdminApiClient } from '@shopify/admin-api-client';
import { formatShopifyAdminClientErrors } from '@/lib/shopify/format-admin-api-errors';
import { getShopifyAdminEnv } from '@/lib/shopify/env';
import type { ShopifyAdminCredentials } from '@/types/shopify';

const SHOP_CURRENCY_QUERY = `query OfficeShopCurrency { shop { currencyCode } }`;

/** In-process cache: shop currency rarely changes; skips an extra Admin round-trip per order. */
const shopCurrencyCache = new Map<string, { code: string; fetchedAt: number }>();
const SHOP_CURRENCY_TTL_MS = 60 * 60 * 1000;

function normalizeStoreDomain(shopDomain: string): string {
  return shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function getCachedShopCurrency(storeKey: string): string | null {
  const row = shopCurrencyCache.get(storeKey);
  if (!row) return null;
  if (Date.now() - row.fetchedAt > SHOP_CURRENCY_TTL_MS) {
    shopCurrencyCache.delete(storeKey);
    return null;
  }
  return row.code;
}

function setCachedShopCurrency(storeKey: string, code: string) {
  shopCurrencyCache.set(storeKey, { code, fetchedAt: Date.now() });
}

type ShopifyAdminApiClient = ReturnType<typeof createAdminApiClient>;

const ORDER_CREATE = `mutation OfficeOrderCreate($order: OrderCreateOrderInput!) {
  orderCreate(order: $order) {
    order {
      id
      name
    }
    userErrors {
      field
      message
    }
  }
}`;

type ShopCurrencyData = { shop?: { currencyCode?: string } | null };
type OrderCreateData = {
  orderCreate?: {
    order?: { id?: string; name?: string | null } | null;
    userErrors?: Array<{ field?: string[] | null; message?: string | null }>;
  } | null;
};

export type CreateShopifyOrderMailingInput = {
  address1: string;
  address2?: string;
  city: string;
  zip: string;
  countryCode: string;
  provinceCode?: string;
  company?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
};

export type CreateShopifyOrderLineInput =
  | { kind: 'variant'; variantGid: string; quantity: number }
  | { kind: 'custom'; title: string; quantity: number; unitPrice: number };

export type CreateShopifyOrderFinancialStatus = 'PENDING' | 'PAID';

/** How the order is fulfilled for Shopify `orderCreate` (line `requiresShipping` + shipping line). */
export type CreateShopifyOrderDeliveryMethod = 'shipping' | 'pickup';

export type CreateShopifyOrderParams = {
  customerShopifyGid: string;
  shippingAddress: CreateShopifyOrderMailingInput;
  billingAddress?: CreateShopifyOrderMailingInput;
  lineItems: CreateShopifyOrderLineInput[];
  financialStatus?: CreateShopifyOrderFinancialStatus;
  note?: string | null;
  /**
   * `shipping`: physical lines get `requiresShipping: true` and a priced shipping line (see `shippingFee`).
   * `pickup`: lines do not require shipping; a $0 "Pick up" shipping line is added for a clear delivery method.
   */
  deliveryMethod?: CreateShopifyOrderDeliveryMethod;
  /** Shop currency; only used when `deliveryMethod` is `shipping`. Defaults to 0. */
  shippingFee?: number;
};

function mailingToGraphqlInput(addr: CreateShopifyOrderMailingInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    address1: addr.address1,
    address2: addr.address2 ?? '',
    city: addr.city,
    zip: addr.zip,
    countryCode: addr.countryCode,
  };
  if (addr.provinceCode?.trim()) {
    out.provinceCode = addr.provinceCode.trim();
  }
  if (addr.company?.trim()) out.company = addr.company.trim();
  if (addr.phone?.trim()) out.phone = addr.phone.trim();
  if (addr.firstName?.trim()) out.firstName = addr.firstName.trim();
  if (addr.lastName?.trim()) out.lastName = addr.lastName.trim();
  return out;
}

async function fetchShopCurrencyCodeWithClient(
  client: ShopifyAdminApiClient,
): Promise<string> {
  const { data, errors } = await client.request<ShopCurrencyData>(SHOP_CURRENCY_QUERY);
  const errText = formatShopifyAdminClientErrors(errors);
  if (errText) {
    throw new Error(`Shopify shop currency query failed: ${errText}`);
  }
  const code = data?.shop?.currencyCode?.trim();
  if (!code) {
    throw new Error('Shopify shop currency query returned no currencyCode');
  }
  return code;
}

function formatDecimalMoney(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0.00';
  return n.toFixed(2);
}

/**
 * @returns Shopify order GID
 */
export async function createShopifyOrder(
  creds: ShopifyAdminCredentials,
  params: CreateShopifyOrderParams,
): Promise<{ orderGid: string; orderName: string | null }> {
  if (!params.lineItems.length) {
    throw new Error('At least one line item is required');
  }

  const storeKey = normalizeStoreDomain(creds.shopDomain);
  const client = createAdminApiClient({
    storeDomain: storeKey,
    apiVersion: creds.apiVersion,
    accessToken: creds.accessToken,
  });

  let currencyCode = getCachedShopCurrency(storeKey);
  if (!currencyCode) {
    currencyCode = await fetchShopCurrencyCodeWithClient(client);
    setCachedShopCurrency(storeKey, currencyCode);
  }

  const billing =
    params.billingAddress ?? params.shippingAddress;

  const deliveryMethod = params.deliveryMethod ?? 'shipping';
  const requiresShipping = deliveryMethod === 'shipping';

  const graphqlLineItems = params.lineItems.map((li) => {
    if (li.kind === 'variant') {
      return {
        variantId: li.variantGid,
        quantity: li.quantity,
        requiresShipping,
      };
    }
    const amount = formatDecimalMoney(li.unitPrice);
    return {
      title: li.title,
      quantity: li.quantity,
      priceSet: {
        shopMoney: { amount, currencyCode },
      },
      requiresShipping,
    };
  });

  const shippingFee = Math.max(
    0,
    Number.isFinite(params.shippingFee ?? 0) ? (params.shippingFee ?? 0) : 0,
  );
  const shippingLines =
    deliveryMethod === 'shipping'
      ? [
          {
            title: 'Shipping',
            code: 'bh-hub-shipping',
            priceSet: {
              shopMoney: {
                amount: formatDecimalMoney(shippingFee),
                currencyCode,
              },
            },
          },
        ]
      : [
          {
            title: 'Pick up',
            code: 'bh-hub-pickup',
            priceSet: {
              shopMoney: {
                amount: '0.00',
                currencyCode,
              },
            },
          },
        ];

  const order: Record<string, unknown> = {
    lineItems: graphqlLineItems,
    customer: {
      toAssociate: { id: params.customerShopifyGid },
    },
    shippingAddress: mailingToGraphqlInput(params.shippingAddress),
    billingAddress: mailingToGraphqlInput(billing),
    shippingLines,
    financialStatus: params.financialStatus ?? 'PENDING',
    sourceName: 'bh-hub',
  };

  if (params.note != null && params.note.trim() !== '') {
    order.note = params.note.trim();
  }

  const { data, errors } = await client.request<OrderCreateData>(ORDER_CREATE, {
    variables: { order },
  });

  const errText = formatShopifyAdminClientErrors(errors);
  if (errText) {
    throw new Error(`Shopify orderCreate failed: ${errText}`);
  }

  const payload = data?.orderCreate;
  const userErrors = payload?.userErrors?.filter(Boolean) ?? [];
  if (userErrors.length > 0) {
    const msg = userErrors
      .map((e) => e.message?.trim() || 'Unknown user error')
      .join('; ');
    throw new Error(msg);
  }

  const orderGid = payload?.order?.id?.trim();
  if (!orderGid) {
    throw new Error('Shopify orderCreate returned no order id');
  }

  return {
    orderGid,
    orderName: payload?.order?.name ?? null,
  };
}

export function createShopifyOrderFromEnv(params: CreateShopifyOrderParams) {
  return createShopifyOrder(getShopifyAdminEnv(), params);
}
