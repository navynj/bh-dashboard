import { prisma } from '@/lib/core/prisma';

export async function updateCostTags(costId: string, tagIds: string[]) {
  await prisma.costTagRelation.deleteMany({ where: { costId } });
  if (tagIds.length === 0) return;
  await prisma.costTagRelation.createMany({
    data: tagIds.map((tagId) => ({ costId, tagId })),
    skipDuplicates: true,
  });
}
