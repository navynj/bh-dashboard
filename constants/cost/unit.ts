// Base gram-equivalent values per unit. 'pc' is excluded — use g_per_pc metadata.
const GRAM_TABLE: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
  ml: 1,
  l: 1000,
};

/** @deprecated import parseUnitToGrams instead */
export const unitToGram: { [key: string]: number } = { ...GRAM_TABLE, pc: 0 };

/**
 * Converts a unit string to its gram-equivalent total, supporting both simple
 * units ("lb", "kg") and compound units ("25lb", "500ml", "100g", "1.5kg").
 * Returns null for "pc" (caller must use g_per_pc) and unknown units.
 */
export function parseUnitToGrams(unit: string): number | null {
  const u = unit.toLowerCase().trim();
  if (!u || u === 'pc') return null;

  // Simple unit
  const exact = GRAM_TABLE[u];
  if (exact != null) return exact;

  // Compound unit: "{quantity}{baseUnit}", e.g. "25lb", "500ml", "1.5kg", "100g"
  const match = u.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (match) {
    const quantity = parseFloat(match[1]!);
    const baseUnit = match[2]!;
    const baseFactor = GRAM_TABLE[baseUnit];
    if (baseFactor != null && quantity > 0) return quantity * baseFactor;
  }

  return null;
}
