/**
 * One-time migration: bh-cost-analysis (legacy Supabase) → bh-hub cost schema
 *
 * Reads from LEGACY_DATABASE_URL (legacy project) via raw pg, writes to
 * DATABASE_URL (bh-hub) via Prisma. Safe to re-run (skipDuplicates: true).
 *
 * Prerequisites:
 *   1. Add LEGACY_DATABASE_URL to core/bh-hub/.env
 *   2. pnpm prisma generate  (picks up Tag rename)
 *   3. Apply the 20260506120000_cost_tag_cleanup migration against bh-hub DB
 *
 * Usage:
 *   pnpm tsx scripts/migrate-from-cost-analysis.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

if (!process.env.LEGACY_DATABASE_URL) {
  throw new Error('LEGACY_DATABASE_URL is not set in .env');
}

// Parse the URL manually to avoid pg URL-encoding / sslmode conflicts with Supabase pooler
const legacyUrl = new URL(process.env.LEGACY_DATABASE_URL);
const legacyPool = new Pool({
  host: legacyUrl.hostname,
  port: parseInt(legacyUrl.port || '5432'),
  user: decodeURIComponent(legacyUrl.username),
  password: decodeURIComponent(legacyUrl.password),
  database: legacyUrl.pathname.replace(/^\//, ''),
  ssl: { rejectUnauthorized: false },
});

const hubPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  log: ['error', 'warn'],
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[migrate] ${msg}`);
}

async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await legacyPool.query(sql, params);
  return res.rows as T[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('Starting migration from bh-cost-analysis → bh-hub');

  // ─── 0. Anonymous fallback user ──────────────────────────────────────────
  log('Step 0: Upserting anonymous legacy user in bh-hub…');
  const anonUser = await hubPrisma.user.upsert({
    where: { email: 'anonymous@legacy-migration' },
    create: {
      email: 'anonymous@legacy-migration',
      name: '(이전된 사용자)',
      status: 'active',
    },
    update: {},
  });
  log(`  anonymous user id: ${anonUser.id}`);

  // ─── Build userId map: legacy id → hub id (fallback: anonUser) ──────────
  log('Step 0b: Building userId map (email matching)…');
  const legacyUsers = await query<{ id: string; email: string | null }>(
    'SELECT id, email FROM "User"',
  );
  const hubUsers = await hubPrisma.user.findMany({ select: { id: true, email: true } });

  const userIdMap = new Map<string, string>();
  let mappedCount = 0;
  let anonCount = 0;
  for (const lu of legacyUsers) {
    const hu = lu.email ? hubUsers.find(u => u.email === lu.email) : undefined;
    if (hu) {
      userIdMap.set(lu.id, hu.id);
      mappedCount++;
    } else {
      userIdMap.set(lu.id, anonUser.id);
      anonCount++;
    }
  }
  log(`  mapped: ${mappedCount}, anonymous fallback: ${anonCount}`);

  // ─── 1. Tags ─────────────────────────────────────────────────────────────
  log('Step 1: Migrating tags…');
  const tags = await query<{
    id: string;
    name: string;
    color: string;
    createdAt: Date;
    updatedAt: Date;
  }>('SELECT id, name, color, "createdAt", "updatedAt" FROM "Tag"');

  await Promise.all(
    tags.map(t =>
      hubPrisma.tag.upsert({
        where: { id: t.id },
        create: { id: t.id, name: t.name, color: t.color, createdAt: t.createdAt, updatedAt: t.updatedAt },
        update: { name: t.name, color: t.color, updatedAt: t.updatedAt },
      }),
    ),
  );
  log(`  tags: ${tags.length} upserted`);

  // ─── 2. Costs ────────────────────────────────────────────────────────────
  log('Step 2: Migrating costs…');
  const costs = await query<{
    id: string;
    title: string;
    totalCount: number;
    lossAmount: number | null;
    finalWeight: number | null;
    locked: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>(
    'SELECT id, title, "totalCount", "lossAmount", "finalWeight", locked, "createdAt", "updatedAt" FROM "Cost"',
  );

  await Promise.all(
    costs.map(c =>
      hubPrisma.cost.upsert({
        where: { id: c.id },
        create: { id: c.id, title: c.title, totalCount: c.totalCount, lossAmount: c.lossAmount, finalWeight: c.finalWeight, locked: c.locked, createdAt: c.createdAt, updatedAt: c.updatedAt },
        update: { title: c.title, totalCount: c.totalCount, lossAmount: c.lossAmount, finalWeight: c.finalWeight, locked: c.locked, updatedAt: c.updatedAt },
      }),
    ),
  );
  log(`  costs: ${costs.length} upserted`);

  // ─── 3. Ingredients ──────────────────────────────────────────────────────
  log('Step 3: Migrating ingredients…');
  const ingredients = await query<{
    id: string;
    title: string;
    unit: string;
    amount: number;
    costId: string;
    variantId: string;
    type: string;
    image: unknown;
    rank: string;
    createdAt: Date;
    updatedAt: Date;
  }>(
    'SELECT id, title, unit, amount, "costId", "variantId", type, image, rank, "createdAt", "updatedAt" FROM "Ingredient"',
  );

  await Promise.all(
    ingredients.map(i =>
      hubPrisma.ingredient.upsert({
        where: { id: i.id },
        create: { id: i.id, title: i.title, unit: i.unit, amount: i.amount, costId: i.costId, variantId: i.variantId, type: i.type, image: i.image as never, rank: i.rank, createdAt: i.createdAt, updatedAt: i.updatedAt },
        update: { title: i.title, unit: i.unit, amount: i.amount, variantId: i.variantId, type: i.type, image: i.image as never, rank: i.rank, updatedAt: i.updatedAt },
      }),
    ),
  );
  log(`  ingredients: ${ingredients.length} upserted`);

  // ─── 4. Packagings ───────────────────────────────────────────────────────
  log('Step 4: Migrating packagings…');
  const packagings = await query<{
    id: string;
    title: string;
    unit: string;
    amount: number;
    costId: string;
    variantId: string;
    type: string;
    image: unknown;
    rank: string;
    createdAt: Date;
    updatedAt: Date;
  }>(
    'SELECT id, title, unit, amount, "costId", "variantId", type, image, rank, "createdAt", "updatedAt" FROM "Packaging"',
  );

  await Promise.all(
    packagings.map(p =>
      hubPrisma.packaging.upsert({
        where: { id: p.id },
        create: { id: p.id, title: p.title, unit: p.unit, amount: p.amount, costId: p.costId, variantId: p.variantId, type: p.type, image: p.image as never, rank: p.rank, createdAt: p.createdAt, updatedAt: p.updatedAt },
        update: { title: p.title, unit: p.unit, amount: p.amount, variantId: p.variantId, type: p.type, image: p.image as never, rank: p.rank, updatedAt: p.updatedAt },
      }),
    ),
  );
  log(`  packagings: ${packagings.length} upserted`);

  // ─── 5. Labors ───────────────────────────────────────────────────────────
  log('Step 5: Migrating labors…');
  const labors = await query<{
    id: string;
    title: string;
    time: number;
    people: number;
    wage: number;
    costId: string;
    rank: string;
    createdAt: Date;
    updatedAt: Date;
  }>(
    'SELECT id, title, time, people, wage, "costId", rank, "createdAt", "updatedAt" FROM "Labor"',
  );

  await Promise.all(
    labors.map(l =>
      hubPrisma.labor.upsert({
        where: { id: l.id },
        create: { id: l.id, title: l.title, time: l.time, people: l.people, wage: l.wage, costId: l.costId, rank: l.rank, createdAt: l.createdAt, updatedAt: l.updatedAt },
        update: { title: l.title, time: l.time, people: l.people, wage: l.wage, rank: l.rank, updatedAt: l.updatedAt },
      }),
    ),
  );
  log(`  labors: ${labors.length} upserted`);

  // ─── 6. Others ───────────────────────────────────────────────────────────
  log('Step 6: Migrating others…');
  const others = await query<{
    id: string;
    title: string;
    amount: number;
    costId: string;
    rank: string;
    createdAt: Date;
    updatedAt: Date;
  }>(
    'SELECT id, title, amount, "costId", rank, "createdAt", "updatedAt" FROM "Other"',
  );

  await Promise.all(
    others.map(o =>
      hubPrisma.other.upsert({
        where: { id: o.id },
        create: { id: o.id, title: o.title, amount: o.amount, costId: o.costId, rank: o.rank, createdAt: o.createdAt, updatedAt: o.updatedAt },
        update: { title: o.title, amount: o.amount, rank: o.rank, updatedAt: o.updatedAt },
      }),
    ),
  );
  log(`  others: ${others.length} upserted`);

  // ─── 7. Prices ───────────────────────────────────────────────────────────
  log('Step 7: Migrating prices…');
  const prices = await query<{
    id: string;
    title: string;
    margin: number;
    price: number;
    costId: string;
    base: string | null;
    rank: string;
    isFinalPrice: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>(
    'SELECT id, title, margin, price, "costId", base, rank, "isFinalPrice", "createdAt", "updatedAt" FROM "Price"',
  );

  await Promise.all(
    prices.map(p =>
      hubPrisma.price.upsert({
        where: { id: p.id },
        create: { id: p.id, title: p.title, margin: p.margin, price: p.price, costId: p.costId, base: p.base, rank: p.rank, isFinalPrice: p.isFinalPrice, createdAt: p.createdAt, updatedAt: p.updatedAt },
        update: { title: p.title, margin: p.margin, price: p.price, base: p.base, rank: p.rank, isFinalPrice: p.isFinalPrice, updatedAt: p.updatedAt },
      }),
    ),
  );
  log(`  prices: ${prices.length} upserted`);

  // ─── 8. Cost-tag relations ───────────────────────────────────────────────
  log('Step 8: Migrating cost-tag relations…');
  const costTags = await query<{ costId: string; tagId: string }>(
    'SELECT "costId", "tagId" FROM "CostTag"',
  );

  await Promise.all(
    costTags.map(ct =>
      hubPrisma.costTagRelation.upsert({
        where: { costId_tagId: { costId: ct.costId, tagId: ct.tagId } },
        create: { costId: ct.costId, tagId: ct.tagId },
        update: {},
      }),
    ),
  );
  log(`  cost-tag relations: ${costTags.length} upserted`);

  // ─── 9. ShopifyConfig ────────────────────────────────────────────────────
  log('Step 9: Migrating ShopifyConfig…');
  const shopifyConfigs = await query<{
    id: string;
    shopifyUrl: string;
    adminToken: string;
    apiVersion: string;
    query: string | null;
    costFieldConfig: unknown;
    productFieldConfig: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>(
    'SELECT id, "shopifyUrl", "adminToken", "apiVersion", query, "costFieldConfig", "productFieldConfig", "createdAt", "updatedAt" FROM "ShopifyConfig" LIMIT 1',
  );

  if (shopifyConfigs.length > 0) {
    const sc = shopifyConfigs[0];
    await hubPrisma.shopifyConfig.upsert({
      where: { id: sc.id },
      create: {
        id: sc.id,
        shopifyUrl: sc.shopifyUrl,
        adminToken: sc.adminToken,
        apiVersion: sc.apiVersion,
        query: sc.query,
        costFieldConfig: (sc.costFieldConfig as never) ?? [],
        productFieldConfig: (sc.productFieldConfig as never) ?? [],
        createdAt: sc.createdAt,
        updatedAt: sc.updatedAt,
      },
      update: {
        shopifyUrl: sc.shopifyUrl,
        adminToken: sc.adminToken,
        apiVersion: sc.apiVersion,
        query: sc.query,
        costFieldConfig: (sc.costFieldConfig as never) ?? [],
        productFieldConfig: (sc.productFieldConfig as never) ?? [],
        updatedAt: sc.updatedAt,
      },
    });
    log('  ShopifyConfig: migrated');
  } else {
    log('  ShopifyConfig: none found, skipping');
  }

  // ─── 10. PriceConfig ─────────────────────────────────────────────────────
  log('Step 10: Migrating PriceConfig…');
  const priceConfigs = await query<{
    id: string;
    defaultPrices: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>('SELECT id, "defaultPrices", "createdAt", "updatedAt" FROM "PriceConfig" LIMIT 1');

  if (priceConfigs.length > 0) {
    const pc = priceConfigs[0];
    await hubPrisma.priceConfig.upsert({
      where: { id: pc.id },
      create: {
        id: pc.id,
        defaultPrices: (pc.defaultPrices as never) ?? [],
        createdAt: pc.createdAt,
        updatedAt: pc.updatedAt,
      },
      update: {
        defaultPrices: (pc.defaultPrices as never) ?? [],
        updatedAt: pc.updatedAt,
      },
    });
    log('  PriceConfig: migrated');
  } else {
    log('  PriceConfig: none found, skipping');
  }

  // ─── 11. CostEditHistory ─────────────────────────────────────────────────
  log('Step 11: Migrating CostEditHistory…');
  const histories = await query<{
    id: string;
    costId: string;
    userId: string;
    log: unknown;
    createdAt: Date;
  }>('SELECT id, "costId", "userId", log, "createdAt" FROM "CostEditHistory"');

  let historyAnonCount = 0;
  const historyData = histories.map(h => {
    const mappedUserId = userIdMap.get(h.userId) ?? anonUser.id;
    if (mappedUserId === anonUser.id) historyAnonCount++;
    return { id: h.id, costId: h.costId, userId: mappedUserId, log: h.log as never, createdAt: h.createdAt };
  });
  await Promise.all(
    historyData.map(h =>
      hubPrisma.costEditHistory.upsert({
        where: { id: h.id },
        create: h,
        update: { userId: h.userId, log: h.log, createdAt: h.createdAt },
      }),
    ),
  );
  log(`  history: ${histories.length} upserted (${historyAnonCount} attributed to anonymous)`);

  // ─── 12. CostMemo ────────────────────────────────────────────────────────
  log('Step 12: Migrating CostMemo…');
  const memos = await query<{
    id: string;
    costId: string;
    userId: string;
    memo: string;
    rank: string;
    createdAt: Date;
    updatedAt: Date;
  }>(
    'SELECT id, "costId", "userId", memo, rank, "createdAt", "updatedAt" FROM "CostMemo"',
  );

  let memoAnonCount = 0;
  const memoData = memos.map(m => {
    const mappedUserId = userIdMap.get(m.userId) ?? anonUser.id;
    if (mappedUserId === anonUser.id) memoAnonCount++;
    return { id: m.id, costId: m.costId, userId: mappedUserId, memo: m.memo, rank: m.rank, createdAt: m.createdAt, updatedAt: m.updatedAt };
  });
  await Promise.all(
    memoData.map(m =>
      hubPrisma.costMemo.upsert({
        where: { id: m.id },
        create: m,
        update: { userId: m.userId, memo: m.memo, rank: m.rank, updatedAt: m.updatedAt },
      }),
    ),
  );
  log(`  memos: ${memos.length} upserted (${memoAnonCount} attributed to anonymous)`);

  // ─── Summary ─────────────────────────────────────────────────────────────
  log('');
  log('Migration complete!');
  log(`  tags:        ${tags.length}`);
  log(`  costs:       ${costs.length}`);
  log(`  ingredients: ${ingredients.length}`);
  log(`  packagings:  ${packagings.length}`);
  log(`  labors:      ${labors.length}`);
  log(`  others:      ${others.length}`);
  log(`  prices:      ${prices.length}`);
  log(`  cost-tags:   ${costTags.length}`);
  log(`  history:     ${histories.length}`);
  log(`  memos:       ${memos.length}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await legacyPool.end();
    await hubPrisma.$disconnect();
  });
