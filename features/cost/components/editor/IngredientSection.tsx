'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Plus, Trash2, AlertCircle, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IngredientEditorItem } from '../../types/cost';
import { computeItemCost } from '../../utils/calculations';
import IngredientSelectDialog from './IngredientSelectDialog';
import GPerPcDialog from './GPerPcDialog';

interface Props {
  title: string;
  items: IngredientEditorItem[];
  disabled?: boolean;
  shopifyAdminUrl?: string;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<IngredientEditorItem>) => void;
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export default function IngredientSection({
  title,
  items,
  disabled,
  shopifyAdminUrl,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
}: Props) {
  const t = useTranslations('Cost');
  const [dialogOpenFor, setDialogOpenFor] = useState<string | null>(null);
  const [gPerPcItem, setGPerPcItem] = useState<IngredientEditorItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Auto-open dialog for newly added items.
  // Intentionally excludes dialogOpenFor from deps — adding it would cause
  // the dialog to reopen immediately after closing when isNew is still true.
  useEffect(() => {
    const newItem = items.find((i) => i.isNew);
    if (newItem) setDialogOpenFor(newItem.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = items.findIndex((i) => i.id === active.id);
    const toIdx = items.findIndex((i) => i.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) onReorder(fromIdx, toIdx);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onAdd}
          disabled={disabled}
        >
          <Plus className="h-3 w-3" />
          {t('addIngredient')}
        </Button>
      </div>

      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-6" />
                  <th className="w-8 text-left px-2 py-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-2 py-2 font-medium text-muted-foreground">
                    {t('ingredientName')}
                  </th>
                  {shopifyAdminUrl && <th className="w-6" />}
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[90px]">
                    {t('amountG')}
                  </th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[90px]">
                    {t('gPrice')}
                  </th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[70px]">
                    g/pc
                  </th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[80px]">
                    {t('cost')}
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {items.map((item, idx) => (
                    <SortableIngredientRow
                      key={item.id}
                      item={item}
                      index={idx}
                      disabled={disabled}
                      shopifyAdminUrl={shopifyAdminUrl}
                      onUpdate={onUpdate}
                      onRemove={onRemove}
                      onOpenDialog={() => setDialogOpenFor(item.id)}
                      onOpenGPerPcDialog={() => setGPerPcItem(item)}
                      isEven={idx % 2 === 0}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>
      )}

      {/* Always mounted so Radix can animate out — only open prop toggles */}
      <IngredientSelectDialog
        open={dialogOpenFor !== null}
        onClose={() => {
          // Mark isNew=false so the auto-open effect doesn't reopen the dialog
          if (dialogOpenFor) onUpdate(dialogOpenFor, { isNew: false });
          setDialogOpenFor(null);
        }}
        onSelect={(patch) => {
          if (dialogOpenFor) {
            onUpdate(dialogOpenFor, { ...patch, isNew: false });
          }
          setDialogOpenFor(null);
        }}
      />

      <GPerPcDialog
        open={gPerPcItem !== null}
        onOpenChange={(o) => { if (!o) setGPerPcItem(null); }}
        variantId={gPerPcItem?.variantId ?? ''}
        productTitle={gPerPcItem?.title ?? ''}
        unit={gPerPcItem?.unit ?? 'pc'}
        unitPrice={gPerPcItem?.unitPrice ?? null}
        currentGPerPc={(gPerPcItem?.metadata?.g_per_pc as number | undefined) ?? null}
        onSaved={(gPerPc, newGPrice) => {
          if (gPerPcItem) {
            onUpdate(gPerPcItem.id, {
              gPrice: newGPrice,
              metadata: { ...(gPerPcItem.metadata ?? {}), g_per_pc: gPerPc },
            });
          }
          setGPerPcItem(null);
        }}
      />
    </div>
  );
}

function SortableIngredientRow({
  item,
  index,
  disabled,
  shopifyAdminUrl,
  onUpdate,
  onRemove,
  onOpenDialog,
  onOpenGPerPcDialog,
  isEven,
}: {
  item: IngredientEditorItem;
  index: number;
  disabled?: boolean;
  shopifyAdminUrl?: string;
  onUpdate: (id: string, patch: Partial<IngredientEditorItem>) => void;
  onRemove: (id: string) => void;
  onOpenDialog: () => void;
  onOpenGPerPcDialog: () => void;
  isEven: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const cost = computeItemCost(item);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={isEven ? 'bg-background' : 'bg-muted/20'}
    >
      {/* Drag handle */}
      <td className="px-1 py-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground p-0.5 rounded"
          disabled={disabled}
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="px-2 py-1 text-muted-foreground">{index + 1}</td>

      {/* Name — clickable to open ingredient dialog */}
      <td className="px-2 py-1">
        <button
          className="flex items-center gap-1.5 w-full text-left rounded hover:bg-muted/60 px-1 py-0.5 transition-colors"
          onClick={onOpenDialog}
          disabled={disabled}
        >
          {item.image?.src ? (
            <div className="relative h-6 w-6 shrink-0 rounded overflow-hidden border">
              <Image src={item.image.src} alt={item.image.alt ?? ''} fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="h-6 w-6 shrink-0 rounded border bg-muted" />
          )}
          <span
            title={item.title || undefined}
            className={`truncate max-w-[260px] ${!item.title ? 'text-muted-foreground' : ''}`}
          >
            {item.title || 'Select ingredient...'}
          </span>
        </button>
      </td>

      {/* Shopify admin link */}
      {shopifyAdminUrl && (
        <td className="px-1 py-1">
          {item.variantId && item.type !== 'cost' ? (
            <a
              href={`${shopifyAdminUrl}/admin/products/variants/${item.variantId.split('/').pop()}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              title="Open in Shopify admin"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span />
          )}
        </td>
      )}

      {/* Amount (g) */}
      <td className="px-2 py-1">
        <Input
          type="number"
          min={0}
          step="0.1"
          className="h-7 text-xs text-right"
          value={item.amount || ''}
          placeholder="0"
          onChange={(e) => onUpdate(item.id, { amount: parseFloat(e.target.value) || 0 })}
          disabled={disabled}
        />
      </td>

      {/* gPrice — shown as $/100g to match column header */}
      <td className="px-2 py-1 text-right tabular-nums">
        {item.gPrice != null ? (
          <span className="text-muted-foreground">${(item.gPrice * 100).toFixed(4)}</span>
        ) : item.variantId && item.type !== 'cost' ? (
          <button
            className="flex items-center gap-1 ml-auto text-destructive hover:text-destructive/80 transition-colors"
            onClick={onOpenGPerPcDialog}
            disabled={disabled}
            title="Set g per Pc"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-xs">g/pc?</span>
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* g per pc */}
      <td className="px-2 py-1 text-right tabular-nums">
        {((item.metadata?.g_per_pc as number | undefined) ?? 0) > 0 ? (
          <span className="text-muted-foreground text-xs">
            {(item.metadata!.g_per_pc as number).toFixed(1)}g
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Computed cost */}
      <td className="px-2 py-1 text-right tabular-nums font-medium">
        {cost != null ? `$${cost.toFixed(4)}` : '—'}
      </td>

      {/* Remove */}
      <td className="px-1 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(item.id)}
          disabled={disabled}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}
