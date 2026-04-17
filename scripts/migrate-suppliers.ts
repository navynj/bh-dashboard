/**
 * Phase 2 migration: extract inline supplier fields from `purchase_orders`
 * into the new `order.suppliers` table, then set `supplier_id` FK on each PO.
 *
 * Groups POs by `supplierCompany` (case-insensitive trim). For each distinct
 * company name, creates a Supplier record and links all matching POs.
 *
 * Safe to re-run: skips POs that already have a `supplierId`.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-suppliers.ts
 */

import 'dotenv/config';
import { prisma } from '../lib/core/prisma';
import {
  looseContactEmailsFromRaw,
  normalizeSupplierContactEmails,
} from '../lib/order/supplier-order-channel';

async function main() {
  const pos = await prisma.purchaseOrder.findMany({
    where: { supplierId: null },
    select: {
      id: true,
      supplierCompany: true,
      supplierContactName: true,
      supplierContactEmail: true,
      supplierExternalId: true,
    },
  });

  if (pos.length === 0) {
    console.log('No POs without supplierId found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${pos.length} POs without supplierId.`);

  const grouped = new Map<
    string,
    {
      company: string;
      contactName: string | null;
      contactEmails: string[];
      poIds: string[];
    }
  >();

  for (const po of pos) {
    const raw = po.supplierCompany?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();

    const fromPo = looseContactEmailsFromRaw(po.supplierContactEmail);

    const existing = grouped.get(key);
    if (existing) {
      existing.poIds.push(po.id);
      if (!existing.contactName && po.supplierContactName) {
        existing.contactName = po.supplierContactName;
      }
      if (fromPo.length > 0) {
        existing.contactEmails = normalizeSupplierContactEmails([
          ...existing.contactEmails,
          ...fromPo,
        ]);
      }
    } else {
      grouped.set(key, {
        company: raw,
        contactName: po.supplierContactName,
        contactEmails: fromPo,
        poIds: [po.id],
      });
    }
  }

  console.log(
    `Grouped into ${grouped.size} distinct suppliers. Creating records...`,
  );

  let created = 0;
  let linked = 0;

  for (const [, entry] of grouped) {
    const supplier = await prisma.supplier.upsert({
      where: { shopifyVendorName: entry.company },
      create: {
        company: entry.company,
        shopifyVendorName: entry.company,
        contactName: entry.contactName,
        contactEmails: normalizeSupplierContactEmails(entry.contactEmails),
      },
      update: {},
    });

    await prisma.purchaseOrder.updateMany({
      where: { id: { in: entry.poIds } },
      data: { supplierId: supplier.id },
    });

    created++;
    linked += entry.poIds.length;

    if (created % 50 === 0) {
      console.log(`  Processed ${created} / ${grouped.size} suppliers...`);
    }
  }

  const skipped = pos.filter((p) => !p.supplierCompany?.trim()).length;

  console.log(
    `Done. Created/matched ${created} suppliers, linked ${linked} POs.` +
      (skipped > 0 ? ` Skipped ${skipped} POs with no supplierCompany.` : ''),
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
