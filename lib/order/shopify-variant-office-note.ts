import type { Prisma, PrismaClient } from '@prisma/client';

type Db = Prisma.TransactionClient | PrismaClient;

export async function loadVariantOfficeNotesMap(
  db: Db,
  variantGids: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(variantGids.map((g) => g.trim()).filter(Boolean))];
  const out = new Map<string, string>();
  if (uniq.length === 0) return out;

  const rows = await db.shopifyVariantOfficeNote.findMany({
    where: { shopifyVariantGid: { in: uniq } },
    select: { shopifyVariantGid: true, note: true },
  });
  for (const r of rows) {
    const n = r.note.trim();
    if (n) out.set(r.shopifyVariantGid, r.note);
  }
  return out;
}

export async function upsertShopifyVariantOfficeNote(
  db: Db,
  shopifyVariantGid: string,
  note: string | null,
): Promise<void> {
  const gid = shopifyVariantGid.trim();
  if (!gid) throw new Error('variantGid is required');

  const trimmed = note?.trim() ?? '';
  if (!trimmed) {
    await db.shopifyVariantOfficeNote.deleteMany({ where: { shopifyVariantGid: gid } });
    return;
  }

  await db.shopifyVariantOfficeNote.upsert({
    where: { shopifyVariantGid: gid },
    create: { shopifyVariantGid: gid, note: trimmed },
    update: { note: trimmed },
  });
}
