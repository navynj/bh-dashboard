/**
 * Import Shopify Auto Purchase Orders CSV export into
 * `order.purchase_orders` + `order.purchase_order_line_items`,
 * linking to `order.shopify_orders` via the implicit many-to-many.
 *
 * IMPORTANT: Run `pnpm sync:shopify` FIRST so ShopifyOrder rows exist for matching.
 *
 * Usage:
 *   pnpm import:po -- /path/to/purchase_orders_export.csv
 *
 * Requires DATABASE_URL. Run `pnpm db:push` (or migrate) before importing.
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { parse as parseDf, isValid } from 'date-fns';
import { parse } from 'csv-parse/sync';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/core/prisma';
import { shippingBillingPayloadFromShopifyExportRow } from '../lib/order/shopify-po-export-csv-address';

type CsvRow = Record<string, string>;

function emptyToNull(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function yn(s: string | undefined): boolean {
  return s?.trim().toLowerCase() === 'yes';
}

function parseMoney(raw: string | undefined): Prisma.Decimal | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/^[−-]/, '-');
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

function parseIntOrNull(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseInt(raw.replace(/,/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function parseExportDate(s: string | undefined): Date | null {
  const t = s?.trim();
  if (!t) return null;
  for (const fmt of ['MMMM dd, yyyy', 'MMMM d, yyyy']) {
    const d = parseDf(t, fmt, new Date());
    if (isValid(d)) return d;
  }
  return null;
}

function parseExportDateTime(s: string | undefined): Date | null {
  const t = s?.trim();
  if (!t) return null;
  for (const fmt of [
    'MMMM dd, yyyy HH:mm',
    'MMMM d, yyyy HH:mm',
    'MMMM dd, yyyy h:mm a',
    'MMMM d, yyyy h:mm a',
  ]) {
    const d = parseDf(t, fmt, new Date());
    if (isValid(d)) return d;
  }
  return null;
}

function headerPayload(row: CsvRow) {
  const legacyExternalId = parseIntOrNull(row['ID']);
  if (legacyExternalId === null) {
    throw new Error(`Missing or invalid ID: ${row['ID']}`);
  }

  return {
    legacyExternalId,
    poNumber: row['PO number']?.trim() ?? String(legacyExternalId),
    legacyCsvStatus: row['Status']?.trim() ?? null,
    ...shippingBillingPayloadFromShopifyExportRow(row),
    currency: row['Currency']?.trim() ?? 'USD',
    isAuto: yn(row['Is Auto']),
    displayTaxColumn: yn(row['Display tax column']),
    comment: emptyToNull(row['Comment']),
    authorizedBy: emptyToNull(row['Authorized by']),
    unitsOrdered: parseIntOrNull(row['Units Ordered']),
    dateCreated: parseExportDate(row['Date created']),
    expectedDate: parseExportDate(row['Expected date']),
    subtotalPrice: parseMoney(row['Subtotal price']),
    discount: parseMoney(row['Discount']),
    discountReason: emptyToNull(row['Discount reason']),
    shippingHandlingPrice: parseMoney(row['Shipping and handling price']),
    totalTaxPrice: parseMoney(row['Total tax price']),
    totalPrice: parseMoney(row['Total price']),
    sourceCreatedAt: parseExportDateTime(row['Created at']),
    sourceUpdatedAt: parseExportDateTime(row['Updated at']),
    completedAt: parseExportDateTime(row['Completed at']),
    supplierCompany: emptyToNull(row['Supplier company']),
    supplierContactName: emptyToNull(row['Supplier contact name']),
    supplierContactEmail: emptyToNull(row['Supplier contact email']),
  };
}

/**
 * Collect distinct Shopify order names (e.g. "#5902") from all CSV rows in a PO group.
 * The CSV column "Shopify Order #" may contain a single value like "#5902".
 */
function collectShopifyOrderNames(group: CsvRow[]): string[] {
  const names = new Set<string>();
  for (const row of group) {
    const raw = row['Shopify Order #']?.trim();
    if (!raw) continue;
    // Handle comma-separated order numbers (e.g. "#5882, #5881")
    for (const part of raw.split(',')) {
      const name = part.trim();
      if (name && name !== '(unknown)') names.add(name);
    }
  }
  return [...names];
}

function linePayload(row: CsvRow, sequence: number) {
  return {
    legacyLineExternalId: parseIntOrNull(row['Product ID']),
    sequence,
    quantity: parseIntOrNull(row['Product Quantity']) ?? 0,
    quantityReceived: parseIntOrNull(row['Product Received']) ?? 0,
    supplierRef: emptyToNull(row['Product Supplier ref']),
    taxPercent: parseMoney(row['Product Tax percent']),
    sku: emptyToNull(row['Product SKU']),
    variantTitle: emptyToNull(row['Product Variant title']),
    productTitle: emptyToNull(row['Product title']),
    shopifyInventoryItemGid: emptyToNull(
      row['Product Shopify InventoryItemID'],
    ),
    shopifyVariantGid: emptyToNull(row['Product Shopify VariantID']),
    shopifyProductGid: emptyToNull(row['Product Shopify ProductID']),
    isCustom: yn(row['Product Is custom']),
    itemPrice: parseMoney(row['Product Item price']),
    lineSubtotalPrice: parseMoney(row['Product Subtotal price']),
    lineTotalTaxPrice: parseMoney(row['Product Total tax price']),
    productProperties: emptyToNull(row['Product Properties']),
  };
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error(
      'Usage: pnpm import:po -- /absolute/path/to/purchase_orders_export.csv',
    );
    process.exit(1);
  }

  const buf = readFileSync(csvPath, 'utf8');
  const rows = parse(buf, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  }) as CsvRow[];

  const byPo = new Map<number, CsvRow[]>();
  let skippedNoId = 0;
  for (const row of rows) {
    const id = parseIntOrNull(row['ID']);
    if (id === null) {
      skippedNoId += 1;
      continue;
    }
    const list = byPo.get(id) ?? [];
    list.push(row);
    byPo.set(id, list);
  }

  if (skippedNoId > 0) {
    console.warn(`Skipped ${skippedNoId} rows with missing/invalid ID.`);
  }

  console.log(`Parsed ${rows.length} CSV rows, ${byPo.size} purchase orders.`);

  // --- Step 1: Drop existing PO data ---
  console.log('[import] Clearing existing PO data…');
  await prisma.purchaseOrderLineItem.deleteMany({});
  await prisma.$executeRawUnsafe(
    `DELETE FROM "order"."_PurchaseOrderToShopifyOrder"`,
  );
  await prisma.purchaseOrder.deleteMany({});
  console.log('[import] Existing PO data cleared.');

  // --- Step 2: Pre-load ShopifyOrder name→id lookup ---
  console.log('[import] Loading ShopifyOrder lookup map…');
  const allShopifyOrders = await prisma.shopifyOrder.findMany({
    select: { id: true, name: true, displayFulfillmentStatus: true },
  });
  type ShopifyOrderRef = { id: string; fulfillStatus: string | null };
  const shopifyOrderByName = new Map<string, ShopifyOrderRef>();
  for (const so of allShopifyOrders) {
    const ref: ShopifyOrderRef = { id: so.id, fulfillStatus: so.displayFulfillmentStatus };
    shopifyOrderByName.set(so.name, ref);
    const stripped = so.name.replace(/^#/, '');
    if (!shopifyOrderByName.has(stripped)) {
      shopifyOrderByName.set(stripped, ref);
    }
  }
  console.log(`[import] Loaded ${allShopifyOrders.length} ShopifyOrder records for matching.`);

  // --- Step 2b: Deduplicate PO numbers (12 CSV POs share a number with another) ---
  const poNumberCounts = new Map<string, number>();
  const poIdToNumber = new Map<number, string>();
  for (const [legacyId, group] of byPo) {
    const rawPo = group[0]['PO number']?.trim() ?? String(legacyId);
    const count = (poNumberCounts.get(rawPo) ?? 0) + 1;
    poNumberCounts.set(rawPo, count);
    poIdToNumber.set(legacyId, count > 1 ? `${rawPo} (${count})` : rawPo);
  }
  const dupeCount = [...poNumberCounts.values()].filter((c) => c > 1).reduce((a, b) => a + b - 1, 0);
  if (dupeCount > 0) console.log(`[import] Disambiguated ${dupeCount} duplicate PO numbers.`);

  // --- Step 3: Import POs ---
  const supplierIdCache = new Map<string, string>();

  async function resolveSupplier(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    company: string | null,
    contactName: string | null,
    contactEmail: string | null,
  ): Promise<string> {
    const name = company?.trim() || '(unknown supplier)';
    const key = name.toLowerCase();
    const cached = supplierIdCache.get(key);
    if (cached) return cached;
    const supplier = await tx.supplier.upsert({
      where: { shopifyVendorName: name },
      create: {
        company: name,
        shopifyVendorName: name,
        contactName,
        contactEmail,
      },
      update: {},
    });
    supplierIdCache.set(key, supplier.id);
    return supplier.id;
  }

  let done = 0;
  let linkedCount = 0;
  let unmatchedNames = 0;

  for (const [legacyId, group] of byPo) {
    const first = group[0];
    const header = headerPayload(first);

    await prisma.$transaction(async (tx) => {
      const supplierId = await resolveSupplier(
        tx,
        header.supplierCompany,
        header.supplierContactName,
        header.supplierContactEmail,
      );

      // Resolve linked ShopifyOrder refs from CSV "Shopify Order #" column
      const orderNames = collectShopifyOrderNames(group);
      const matchedRefs: ShopifyOrderRef[] = [];
      for (const name of orderNames) {
        const ref = shopifyOrderByName.get(name);
        if (ref) {
          matchedRefs.push(ref);
        } else {
          unmatchedNames++;
        }
      }

      // Compute fulfillment-based status from linked Shopify orders
      const fulfilledCount = matchedRefs.filter(
        (r) => r.fulfillStatus === 'FULFILLED',
      ).length;
      const total = matchedRefs.length;
      const allFulfilled = total > 0 && fulfilledCount === total;
      let status: string;
      if (header.completedAt && allFulfilled) status = 'completed';
      else if (allFulfilled) status = 'fulfilled';
      else if (fulfilledCount > 0) status = 'partially_fulfilled';
      else status = 'unfulfilled';

      const {
        supplierCompany: _sc,
        supplierContactName: _scn,
        supplierContactEmail: _sce,
        legacyCsvStatus: _ls,
        ...cleanHeader
      } = header;

      // Use deduplicated PO number
      cleanHeader.poNumber = poIdToNumber.get(legacyId) ?? cleanHeader.poNumber;

      const po = await tx.purchaseOrder.create({
        data: {
          ...cleanHeader,
          status,
          supplierId,
          shopifyOrders: matchedRefs.length > 0
            ? { connect: matchedRefs.map((r) => ({ id: r.id })) }
            : undefined,
        },
      });

      linkedCount += matchedRefs.length;

      const lines = group.map((r, sequence) => ({
        ...linePayload(r, sequence),
        purchaseOrderId: po.id,
      }));

      await tx.purchaseOrderLineItem.createMany({ data: lines });
    });

    done += 1;
    if (done % 500 === 0) {
      console.log(`Imported ${done} / ${byPo.size} POs…`);
    }
  }

  console.log(
    `[import] Done. Created ${byPo.size} POs, ` +
    `linked ${linkedCount} ShopifyOrder relations, ` +
    `${unmatchedNames} order names had no ShopifyOrder match.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
