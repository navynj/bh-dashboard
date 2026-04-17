import { Badge } from '@/components/ui/badge';
import type { SupplierKey, SupplierEntry, PoPanelMeta } from '../types';
import { formatVancouverOrderedDetail } from '../utils/vancouver-datetime';

type Props = {
  entry: SupplierEntry;
  activeKey: SupplierKey;
  poPanelMeta?: PoPanelMeta;
  selectedPoBlockId?: string | null;
};

function fmt(d: string | null) {
  return d ?? '—';
}

const MAX_VISIBLE_BADGES = 4;

export function CenterBar({
  entry,
  activeKey,
  poPanelMeta,
  selectedPoBlockId,
}: Props) {
  void activeKey;

  const isDrafts = selectedPoBlockId === '__drafts__';

  let headline: string;
  let sub: string;

  if (isDrafts) {
    headline = `${entry.withoutPoDraftCount} Without PO`;
    sub = entry.supplierCompany;
  } else if (poPanelMeta) {
    headline = `PO #${poPanelMeta.poNumber}`;
    sub = `${entry.supplierCompany} · Ordered ${formatVancouverOrderedDetail(poPanelMeta.orderedAt)} · created ${fmt(poPanelMeta.dateCreated)} · expected ${fmt(poPanelMeta.expectedDate)}`;
  } else {
    headline = entry.supplierCompany;
    sub = entry.meta;
  }

  const linked = poPanelMeta?.linkedShopifyOrders ?? [];
  const visible = linked.slice(0, MAX_VISIBLE_BADGES);
  const overflow = linked.length - MAX_VISIBLE_BADGES;

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 border-b bg-background flex-shrink-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium font-mono leading-tight flex-shrink-0">
            {headline}
          </span>
          {!isDrafts &&
            visible.map((o) => (
              <Badge
                key={o.id}
                variant="blue"
                className="rounded px-1.5 text-[10px] flex-shrink-0"
              >
                {o.name}
              </Badge>
            ))}
          {!isDrafts && overflow > 0 && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              +{overflow} more
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{sub}</div>
      </div>
    </div>
  );
}
