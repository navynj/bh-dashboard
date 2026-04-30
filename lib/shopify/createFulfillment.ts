/**
 * Creates a Shopify fulfillment for a given order using the Admin GraphQL API.
 *
 * Flow:
 *  1. Fetch fulfillment orders for the Shopify order (to get FulfillmentOrder GIDs)
 *  2. Map our line item GIDs to FulfillmentOrderLineItem GIDs
 *  3. Call `fulfillmentCreateV2` mutation
 */

import {
  createAdminApiClient,
  type AdminApiClient,
} from '@shopify/admin-api-client';
import type { ShopifyAdminCredentials } from '@/types/shopify';

/** Reuse one client per server request when fulfilling multiple orders (connection reuse). */
export function createShopifyAdminGraphqlClient(
  creds: ShopifyAdminCredentials,
): AdminApiClient {
  return createAdminApiClient({
    storeDomain: creds.shopDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, ''),
    apiVersion: creds.apiVersion,
    accessToken: creds.accessToken,
  });
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ShopifyLineItemToFulfill = {
  /** gid://shopify/LineItem/xxx */
  shopifyLineItemGid: string;
  quantity: number;
};

type FulfillmentOrdersData = {
  order: {
    fulfillmentOrders: {
      nodes: Array<{
        id: string;
        status: string;
        lineItems: {
          nodes: Array<{
            id: string;
            lineItem: { id: string };
            remainingQuantity: number;
          }>;
        };
      }>;
    };
  } | null;
};

type FulfillmentCreateData = {
  fulfillmentCreateV2: {
    fulfillment: { id: string; status: string } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
};

// ─── Queries / Mutations ───────────────────────────────────────────────────────

const FULFILLMENT_ORDERS_QUERY = `
  query GetFulfillmentOrders($orderId: ID!) {
    order(id: $orderId) {
      fulfillmentOrders(first: 10) {
        nodes {
          id
          status
          lineItems(first: 250) {
            nodes {
              id
              lineItem { id }
              remainingQuantity
            }
          }
        }
      }
    }
  }
`;

const FULFILLMENT_CREATE_MUTATION = `
  mutation FulfillmentCreate($fulfillment: FulfillmentV2Input!) {
    fulfillmentCreateV2(fulfillment: $fulfillment) {
      fulfillment {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Main function ─────────────────────────────────────────────────────────────

export type CreateFulfillmentResult =
  | { ok: true; fulfillmentId?: string }
  | { ok: false; errors: string[] };

/**
 * Creates a Shopify fulfillment for the given order, covering the specified line items.
 * Returns `ok: true` even if there are no fulfillable items (already fulfilled, etc.)
 */
export async function createShopifyFulfillment(
  creds: ShopifyAdminCredentials,
  shopifyOrderGid: string,
  lineItems: ShopifyLineItemToFulfill[],
  options?: { notifyCustomer?: boolean; adminClient?: AdminApiClient },
): Promise<CreateFulfillmentResult> {
  const client =
    options?.adminClient ?? createShopifyAdminGraphqlClient(creds);

  // Step 1: Get fulfillment orders
  const { data: foData, errors: foErrors } =
    await client.request<FulfillmentOrdersData>(FULFILLMENT_ORDERS_QUERY, {
      variables: { orderId: shopifyOrderGid },
    });

  if (foErrors || !foData?.order) {
    console.error('[createShopifyFulfillment] Failed to fetch fulfillment orders:', foErrors);
    return { ok: false, errors: ['Failed to fetch fulfillment orders from Shopify'] };
  }

  // Build lookup: lineItemGid → { foId, foLineItemId, remainingQty }
  const lineItemMap = new Map<
    string,
    { foId: string; foLineItemId: string; remainingQty: number }
  >();

  for (const fo of foData.order.fulfillmentOrders.nodes) {
    if (fo.status !== 'OPEN' && fo.status !== 'IN_PROGRESS') continue;
    for (const foLi of fo.lineItems.nodes) {
      lineItemMap.set(foLi.lineItem.id, {
        foId: fo.id,
        foLineItemId: foLi.id,
        remainingQty: foLi.remainingQuantity,
      });
    }
  }

  // Group our items by fulfillment order
  const byFo = new Map<string, Array<{ id: string; quantity: number }>>();
  for (const li of lineItems) {
    const mapped = lineItemMap.get(li.shopifyLineItemGid);
    if (!mapped) continue;
    const qty = Math.min(li.quantity, mapped.remainingQty);
    if (qty <= 0) continue;
    if (!byFo.has(mapped.foId)) byFo.set(mapped.foId, []);
    byFo.get(mapped.foId)!.push({ id: mapped.foLineItemId, quantity: qty });
  }

  if (byFo.size === 0) {
    // Nothing to fulfill (already done or items don't match)
    return { ok: true };
  }

  // Step 2: Create fulfillment
  const lineItemsByFulfillmentOrder = [...byFo.entries()].map(
    ([foId, items]) => ({
      fulfillmentOrderId: foId,
      fulfillmentOrderLineItems: items,
    }),
  );

  const { data: createData, errors: createErrors } =
    await client.request<FulfillmentCreateData>(FULFILLMENT_CREATE_MUTATION, {
      variables: {
        fulfillment: {
          notifyCustomer: options?.notifyCustomer ?? false,
          lineItemsByFulfillmentOrder,
        },
      },
    });

  if (createErrors || !createData) {
    console.error('[createShopifyFulfillment] Mutation error:', createErrors);
    return { ok: false, errors: ['Failed to create Shopify fulfillment'] };
  }

  const { fulfillment, userErrors } = createData.fulfillmentCreateV2;
  if (userErrors.length > 0) {
    const msgs = userErrors.map((e) => e.message);
    console.error('[createShopifyFulfillment] userErrors:', msgs);
    return { ok: false, errors: msgs };
  }

  return { ok: true, fulfillmentId: fulfillment?.id };
}
