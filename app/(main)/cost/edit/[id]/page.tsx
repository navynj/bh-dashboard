import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';
type JsonValue = Prisma.JsonValue;
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { enhanceCostItems } from '@/lib/cost/item-enhancement';
import CostEditor from '@/features/cost/components/editor/CostEditor';
import type { CostDetailApiResponse, IngredientApiItem } from '@/features/cost/types/cost';

type RouteContext = { params: Promise<{ id: string }> };

const COST_INCLUDE = {
  ingredients: { orderBy: { rank: 'asc' as const } },
  packagings: { orderBy: { rank: 'asc' as const } },
  labors: { orderBy: { rank: 'asc' as const } },
  others: { orderBy: { rank: 'asc' as const } },
  prices: { orderBy: { rank: 'asc' as const } },
  costMemos: {
    orderBy: { rank: 'asc' as const },
    include: { User: { select: { name: true, email: true } } },
  },
  costTagRelations: { include: { Tag: true } },
} as const;

function parseImage(raw: JsonValue): { src: string; alt: string } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.src === 'string') return { src: obj.src, alt: typeof obj.alt === 'string' ? obj.alt : '' };
  return null;
}

function toIngredientItem(
  i: { id: string; title: string; unit: string; amount: number; costId: string; variantId: string; type: string; image: JsonValue; rank: string } & { unitPrice?: number | null; amountPrice?: number | null; gPrice?: number | null },
): IngredientApiItem {
  return {
    id: i.id,
    title: i.title,
    unit: i.unit,
    amount: i.amount,
    costId: i.costId,
    variantId: i.variantId,
    type: i.type,
    image: parseImage(i.image),
    rank: i.rank,
    unitPrice: i.unitPrice ?? null,
    amountPrice: i.amountPrice ?? null,
    gPrice: i.gPrice ?? null,
  };
}

export default async function CostEditPage({ params }: RouteContext) {
  const session = await auth();
  if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
    notFound();
  }

  const { id } = await params;
  const raw = await prisma.cost.findUnique({ where: { id }, include: COST_INCLUDE });
  if (!raw) notFound();

  const shopifyConfig = await prisma.shopifyConfig.findFirst();
  const enriched = shopifyConfig ? await enhanceCostItems(raw, shopifyConfig) : raw;

  const { costTagRelations, costMemos, ingredients, packagings, ...rest } = enriched;

  const cost: CostDetailApiResponse = {
    id: rest.id,
    title: rest.title,
    totalCount: rest.totalCount,
    lossAmount: rest.lossAmount ?? null,
    finalWeight: rest.finalWeight ?? null,
    locked: rest.locked,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
    ingredients: ingredients.map(toIngredientItem),
    packagings: packagings.map(toIngredientItem),
    labors: rest.labors.map((l) => ({ id: l.id, title: l.title, time: l.time, people: l.people, wage: l.wage, costId: l.costId, rank: l.rank })),
    others: rest.others.map((o) => ({ id: o.id, title: o.title, amount: o.amount, costId: o.costId, rank: o.rank })),
    prices: rest.prices.map((p) => ({ id: p.id, title: p.title, margin: p.margin, price: p.price, base: p.base, isFinalPrice: p.isFinalPrice, rank: p.rank, costId: p.costId })),
    costMemos: costMemos.map(({ User, ...m }) => ({
      id: m.id,
      memo: m.memo,
      rank: m.rank,
      userId: m.userId,
      user: User,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    tags: costTagRelations.map((r) => ({ id: r.Tag.id, name: r.Tag.name, color: r.Tag.color })),
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 px-4 py-6">
      <CostEditor initialCost={cost} />
    </div>
  );
}
