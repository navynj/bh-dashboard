import { LexoRank } from 'lexorank';

export function getNextRank(existingRanks: string[]): string {
  if (existingRanks.length === 0) return LexoRank.middle().toString();
  const last = existingRanks[existingRanks.length - 1]!;
  try {
    return LexoRank.parse(last).genNext().toString();
  } catch {
    return LexoRank.middle().toString();
  }
}

export function reorderRanks<T extends { rank: string }>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  const reordered = [...items];
  const [moved] = reordered.splice(fromIndex, 1);
  if (!moved) return items;
  reordered.splice(toIndex, 0, moved);

  return reordered.map((item, i) => {
    const prev = reordered[i - 1];
    const next = reordered[i + 1];
    try {
      let newRank: LexoRank;
      if (!prev && next) {
        newRank = LexoRank.parse(next.rank).genPrev();
      } else if (prev && !next) {
        newRank = LexoRank.parse(prev.rank).genNext();
      } else if (prev && next) {
        newRank = LexoRank.parse(prev.rank).between(LexoRank.parse(next.rank));
      } else {
        newRank = LexoRank.middle();
      }
      return { ...item, rank: newRank.toString() };
    } catch {
      return item;
    }
  });
}
