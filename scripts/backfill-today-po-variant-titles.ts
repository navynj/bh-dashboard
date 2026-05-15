/**
 * Backfill variantTitle on purchase_order_line_items created today where
 * the linked shopify_order_line_items row has a variantTitle but the PO line
 * was saved with variantTitle = null (due to a frontend bug now fixed).
 *
 * Scopes to PO lines whose linked Shopify order was processed/created today
 * (Vancouver time, 2026-05-15).
 *
 * Usage:
 *   npx tsx scripts/backfill-today-po-variant-titles.ts
 *   npx tsx scripts/backfill-today-po-variant-titles.ts --dry-run
 */

import 'dotenv/config';
import { prisma } from '../lib/core/prisma';

const isDryRun = process.argv.includes('--dry-run');

// Vancouver UTC offset: UTC-7 (PDT) in May
const VANCOUVER_OFFSET_HOURS = -7;
const TODAY_YMD = '2026-05-15';

function vancouverDayBounds(ymd: string): { start: Date; end: Date } {
  const offsetMs = VANCOUVER_OFFSET_HOURS * 60 * 60 * 1000;
  const start = new Date(`${ymd}T00:00:00.000Z`);
  start.setTime(start.getTime() - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function main() {
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Backfilling variantTitle for PO line items from orders on ${TODAY_YMD} (Vancouver)\n`);

  const { start, end } = vancouverDayBounds(TODAY_YMD);
  console.log(`Order date window: ${start.toISOString()} – ${end.toISOString()}`);

  // Find PO line items where:
  // 1. variantTitle IS null (missing — the bug)
  // 2. Linked ShopifyOrderLineItem has a non-null variantTitle
  // 3. The parent Shopify order was processed/created today (Vancouver)
  const affected = await prisma.purchaseOrderLineItem.findMany({
    where: {
      variantTitle: null,
      shopifyOrderLineItem: {
        variantTitle: { not: null },
        order: {
          OR: [
            { processedAt: { gte: start, lt: end } },
            { shopifyCreatedAt: { gte: start, lt: end } },
          ],
        },
      },
    },
    select: {
      id: true,
      productTitle: true,
      variantTitle: true,
      shopifyOrderLineItem: {
        select: {
          id: true,
          variantTitle: true,
          title: true,
          order: {
            select: { name: true, processedAt: true, shopifyCreatedAt: true },
          },
        },
      },
    },
  });

  if (affected.length === 0) {
    console.log('No affected PO line items found — nothing to update.');
    return;
  }

  console.log(`\nFound ${affected.length} PO line item(s) to update:\n`);

  for (const row of affected) {
    const soli = row.shopifyOrderLineItem!;
    const orderName = soli.order?.name ?? '—';
    const date = (soli.order?.processedAt ?? soli.order?.shopifyCreatedAt)?.toISOString().slice(0, 10) ?? '—';
    console.log(
      `  [${row.id}] Order ${orderName} (${date}) | "${soli.title}" → variantTitle: "${soli.variantTitle}"`,
    );
  }

  if (isDryRun) {
    console.log('\nDry run — no changes written.');
    return;
  }

  let updated = 0;
  for (const row of affected) {
    const newVariantTitle = row.shopifyOrderLineItem!.variantTitle!;
    await prisma.purchaseOrderLineItem.update({
      where: { id: row.id },
      data: { variantTitle: newVariantTitle },
    });
    updated++;
  }

  console.log(`\nDone — updated ${updated} record(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
