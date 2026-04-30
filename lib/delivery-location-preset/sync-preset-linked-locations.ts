import type { PrismaClient } from '@prisma/client';

type LocationDb = Pick<PrismaClient, 'location'>;

/**
 * Sets which `public.locations` rows point at this preset. Clears any previous links
 * to `presetId`, then assigns `locationIds` (many locations may share one preset).
 */
export async function syncPresetLinkedLocations(
  db: LocationDb,
  presetId: string,
  locationIds: readonly string[],
): Promise<void> {
  await db.location.updateMany({
    where: { deliveryLocationPresetId: presetId },
    data: { deliveryLocationPresetId: null },
  });
  const uniq = [...new Set(locationIds.filter(Boolean))];
  if (uniq.length === 0) return;
  await db.location.updateMany({
    where: { id: { in: uniq } },
    data: { deliveryLocationPresetId: presetId },
  });
}
