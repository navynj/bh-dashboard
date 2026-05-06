export interface ItemChange {
  type: 'added' | 'deleted' | 'modified';
  itemType: string;
  item: { title: string; id: string };
  changes?: Record<string, { from: unknown; to: unknown }>;
}

interface ComparableItem {
  id: string;
  title?: string;
  [key: string]: unknown;
}

const FIELDS_TO_COMPARE = ['title', 'amount', 'unit', 'time', 'people', 'wage', 'margin', 'price'];

export function compareItems(
  prevItems: ComparableItem[],
  payloadItems: ComparableItem[] | undefined,
  itemType: string,
): ItemChange[] {
  const changes: ItemChange[] = [];
  const prevMap = new Map(prevItems.map((i) => [i.id, i]));
  const prevIds = new Set(prevItems.map((i) => i.id));
  const payloadIds = new Set((payloadItems ?? []).map((i) => i.id));

  for (const item of payloadItems ?? []) {
    if (!prevIds.has(item.id)) {
      changes.push({ type: 'added', itemType, item: { title: (item.title as string) || item.id, id: item.id } });
    }
  }

  for (const item of prevItems) {
    if (!payloadIds.has(item.id)) {
      changes.push({ type: 'deleted', itemType, item: { title: (item.title as string) || item.id, id: item.id } });
    }
  }

  for (const item of payloadItems ?? []) {
    if (!prevIds.has(item.id)) continue;
    const prev = prevMap.get(item.id);
    if (!prev) continue;
    const fieldChanges: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of FIELDS_TO_COMPARE) {
      if (field in item && field in prev && item[field] !== prev[field]) {
        fieldChanges[field] = { from: prev[field], to: item[field] };
      }
    }
    if (Object.keys(fieldChanges).length > 0) {
      changes.push({ type: 'modified', itemType, item: { title: (item.title as string) || item.id, id: item.id }, changes: fieldChanges });
    }
  }

  return changes;
}
