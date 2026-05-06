import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/prisma';
import type {
  IngredientSaveItem,
  LaborSaveItem,
  OtherSaveItem,
  PackagingSaveItem,
} from '@/features/cost/types/cost';

export async function processIngredientsBatch(costId: string, items: IngredientSaveItem[]) {
  const ids = items.map((i) => i.id);
  await prisma.ingredient.deleteMany({ where: { costId, id: { notIn: ids } } });

  for (const item of items) {
    await prisma.ingredient.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        costId,
        title: item.title,
        unit: item.unit,
        amount: item.amount,
        variantId: item.variantId,
        type: item.type,
        image: item.image ? (item.image as Prisma.InputJsonValue) : Prisma.JsonNull,
        rank: item.rank,
      },
      update: {
        title: item.title,
        unit: item.unit,
        amount: item.amount,
        variantId: item.variantId,
        type: item.type,
        image: item.image ? (item.image as Prisma.InputJsonValue) : Prisma.JsonNull,
        rank: item.rank,
      },
    });
  }
}

export async function processPackagingsBatch(costId: string, items: PackagingSaveItem[]) {
  const ids = items.map((i) => i.id);
  await prisma.packaging.deleteMany({ where: { costId, id: { notIn: ids } } });

  for (const item of items) {
    await prisma.packaging.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        costId,
        title: item.title,
        unit: item.unit,
        amount: item.amount,
        variantId: item.variantId,
        type: item.type,
        image: item.image ? (item.image as Prisma.InputJsonValue) : Prisma.JsonNull,
        rank: item.rank,
      },
      update: {
        title: item.title,
        unit: item.unit,
        amount: item.amount,
        variantId: item.variantId,
        type: item.type,
        image: item.image ? (item.image as Prisma.InputJsonValue) : Prisma.JsonNull,
        rank: item.rank,
      },
    });
  }
}

export async function processLaborsBatch(costId: string, items: LaborSaveItem[]) {
  const ids = items.map((i) => i.id);
  await prisma.labor.deleteMany({ where: { costId, id: { notIn: ids } } });

  for (const item of items) {
    await prisma.labor.upsert({
      where: { id: item.id },
      create: { id: item.id, costId, title: item.title, time: item.time, people: item.people, wage: item.wage, rank: item.rank },
      update: { title: item.title, time: item.time, people: item.people, wage: item.wage, rank: item.rank },
    });
  }
}

export async function processOthersBatch(costId: string, items: OtherSaveItem[]) {
  const ids = items.map((i) => i.id);
  await prisma.other.deleteMany({ where: { costId, id: { notIn: ids } } });

  for (const item of items) {
    await prisma.other.upsert({
      where: { id: item.id },
      create: { id: item.id, costId, title: item.title, amount: item.amount, rank: item.rank },
      update: { title: item.title, amount: item.amount, rank: item.rank },
    });
  }
}
