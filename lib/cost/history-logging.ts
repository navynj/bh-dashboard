import { prisma } from '@/lib/core/prisma';
import { Prisma } from '@prisma/client';

export async function logCostHistory(
  costId: string,
  userId: string,
  action: 'created' | 'updated' | 'locked' | 'unlocked',
  changes?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.costEditHistory.create({
      data: {
        costId,
        userId,
        log: {
          action,
          changes: changes ?? {},
          timestamp: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Non-fatal: don't fail the request on history write errors
  }
}
