/**
 * Full sync of Shopify orders into local DB tables:
 *   order.shopify_customers
 *   order.shopify_orders
 *   order.shopify_order_line_items
 *
 * Paginates through ALL Shopify orders (Admin GraphQL API) and upserts
 * customers, orders, and line items. Safe to re-run (idempotent via shopifyGid).
 *
 * Usage:
 *   pnpm sync:shopify
 *
 * Requires DATABASE_URL, SHOPIFY_SHOP_DOMAIN, SHOPIFY_ADMIN_TOKEN.
 */

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/core/prisma';
import { fetchAllShopifyOrders } from '../lib/shopify/fetchOrders';
import { getShopifyAdminEnv } from '../lib/shopify/env';
import type { ShopifyOrderNode } from '../types/shopify';
import { lineItemImageUrlFromShopifyNode } from '../lib/shopify/line-item-image-url';

function parseOrderNumber(name: string | null): number {
  if (!name) return 0;
  const digits = name.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function toDecimalOrNull(amount: string | null | undefined): Prisma.Decimal | null {
  if (!amount) return null;
  const n = parseFloat(amount);
  return isNaN(n) ? null : new Prisma.Decimal(n);
}

function addressToJson(addr: ShopifyOrderNode['billingAddress']): Prisma.InputJsonValue | undefined {
  if (!addr) return undefined;
  return {
    address1: addr.address1,
    address2: addr.address2,
    city: addr.city,
    province: addr.province,
    country: addr.country,
    zip: addr.zip,
    company: addr.company,
    name: addr.name,
    phone: addr.phone,
  };
}

async function main() {
  const creds = getShopifyAdminEnv();
  console.log(`[sync] Fetching all Shopify orders from ${creds.shopDomain}…`);

  const { orders, pagesFetched } = await fetchAllShopifyOrders(creds, {
    pageSize: 40,
    maxPages: 200,
  });

  console.log(`[sync] Fetched ${orders.length} orders across ${pagesFetched} page(s).`);

  const customerMap = new Map<string, ShopifyOrderNode['customer']>();
  for (const order of orders) {
    if (order.customer?.id && !customerMap.has(order.customer.id)) {
      customerMap.set(order.customer.id, order.customer);
    }
  }

  console.log(`[sync] Upserting ${customerMap.size} customers…`);
  let custDone = 0;
  for (const [gid, cust] of customerMap) {
    if (!cust) continue;
    const company =
      // Try to derive company from billing address of any order by this customer
      orders.find((o) => o.customer?.id === gid)?.billingAddress?.company ?? null;

    await prisma.shopifyCustomer.upsert({
      where: { shopifyGid: gid },
      create: {
        shopifyGid: gid,
        displayName: cust.displayName,
        email: cust.email,
        phone: cust.phone,
        company,
        syncedAt: new Date(),
      },
      update: {
        displayName: cust.displayName,
        email: cust.email,
        phone: cust.phone,
        company,
        syncedAt: new Date(),
      },
    });
    custDone++;
    if (custDone % 50 === 0) console.log(`  customers: ${custDone}/${customerMap.size}`);
  }
  console.log(`[sync] Upserted ${custDone} customers.`);

  console.log(`[sync] Upserting ${orders.length} orders + line items…`);
  let ordersDone = 0;
  for (const order of orders) {
    const customerId = order.customer?.id
      ? (await prisma.shopifyCustomer.findUnique({
          where: { shopifyGid: order.customer.id },
          select: { id: true },
        }))?.id ?? null
      : null;

    const shopifyOrder = await prisma.shopifyOrder.upsert({
      where: { shopifyGid: order.id },
      create: {
        shopifyGid: order.id,
        name: order.name ?? '',
        orderNumber: parseOrderNumber(order.name),
        customerId,
        email: order.email,
        displayFulfillmentStatus: order.displayFulfillmentStatus,
        displayFinancialStatus: order.displayFinancialStatus,
        currencyCode: order.currencyCode,
        totalPrice: toDecimalOrNull(order.totalPriceSet?.shopMoney?.amount),
        processedAt: order.processedAt ? new Date(order.processedAt) : null,
        shopifyCreatedAt: order.createdAt ? new Date(order.createdAt) : null,
        billingAddress: addressToJson(order.billingAddress),
        shippingAddress: addressToJson(order.shippingAddress),
        syncedAt: new Date(),
      },
      update: {
        name: order.name ?? '',
        orderNumber: parseOrderNumber(order.name),
        customerId,
        email: order.email,
        displayFulfillmentStatus: order.displayFulfillmentStatus,
        displayFinancialStatus: order.displayFinancialStatus,
        currencyCode: order.currencyCode,
        totalPrice: toDecimalOrNull(order.totalPriceSet?.shopMoney?.amount),
        processedAt: order.processedAt ? new Date(order.processedAt) : null,
        shopifyCreatedAt: order.createdAt ? new Date(order.createdAt) : null,
        billingAddress: addressToJson(order.billingAddress),
        shippingAddress: addressToJson(order.shippingAddress),
        syncedAt: new Date(),
      },
    });

    // Delete existing line items to replace with fresh data
    await prisma.shopifyOrderLineItem.deleteMany({
      where: { orderId: shopifyOrder.id },
    });

    const lineItems = order.lineItems.edges.map((edge) => edge.node);
    if (lineItems.length > 0) {
      await prisma.shopifyOrderLineItem.createMany({
        data: lineItems.map((li) => ({
          shopifyGid: li.id,
          orderId: shopifyOrder.id,
          title: li.title,
          sku: li.sku ?? li.variant?.sku ?? null,
          variantTitle: li.variant?.title ?? null,
          variantGid: li.variant?.id ?? null,
          imageUrl: lineItemImageUrlFromShopifyNode(li),
          vendor: li.vendor ?? null,
          quantity: li.quantity,
          price: toDecimalOrNull(li.discountedUnitPriceSet?.shopMoney?.amount),
          unitCost: toDecimalOrNull(li.variant?.inventoryItem?.unitCost?.amount),
        })),
        skipDuplicates: true,
      });
    }

    ordersDone++;
    if (ordersDone % 200 === 0) {
      console.log(`  orders: ${ordersDone}/${orders.length}`);
    }
  }

  console.log(`[sync] Done. Upserted ${ordersDone} orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
