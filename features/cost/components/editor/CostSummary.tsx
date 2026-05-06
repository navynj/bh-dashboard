'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import type { CostEditorState } from '../../types/cost';

interface Props {
  state: CostEditorState;
  ingredientCost: number;
  packagingCost: number;
  laborCost: number;
  otherCost: number;
  totalCost: number;
  pricePerProduct: number;
  disabled?: boolean;
  onTotalCountChange: (v: number) => void;
  onLossAmountChange: (v: number | null) => void;
  onFinalWeightChange: (v: number | null) => void;
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">${value.toFixed(2)}</span>
    </div>
  );
}

export default function CostSummary({
  state,
  ingredientCost,
  packagingCost,
  laborCost,
  otherCost,
  totalCost,
  pricePerProduct,
  disabled,
  onTotalCountChange,
  onLossAmountChange,
  onFinalWeightChange,
}: Props) {
  const t = useTranslations('Cost');

  const totalWeight = state.ingredients.reduce((s, i) => s + i.amount, 0);
  const weightPerPiece = state.totalCount > 0 ? totalWeight / state.totalCount : 0;
  const finalWeightPerPiece = state.finalWeight ?? weightPerPiece;
  const lossPerPiece = weightPerPiece - finalWeightPerPiece;
  const lossRate = totalWeight > 0 && lossPerPiece > 0 && state.totalCount > 0
    ? (lossPerPiece * state.totalCount / totalWeight) * 100
    : 0;

  return (
    <div className="space-y-4">
      {/* Cost breakdown */}
      <div className="rounded-md border p-4 space-y-2">
        <h4 className="font-semibold text-sm">{t('totalCost')}</h4>
        <CostRow label={t('ingredients')} value={ingredientCost} />
        <CostRow label={t('packaging')} value={packagingCost} />
        <CostRow label={t('labor')} value={laborCost} />
        <CostRow label={t('other')} value={otherCost} />
        <div className="border-t pt-2 flex justify-between font-semibold">
          <span>{t('totalCost')}</span>
          <span className="tabular-nums">${totalCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t('unitPrice')}</span>
          <span className="tabular-nums font-medium text-foreground">
            ${pricePerProduct.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Total count */}
      <div className="rounded-md border p-4 space-y-2">
        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          {t('totalCount')}
        </Label>
        <Input
          type="number"
          min={1}
          className="h-8"
          value={state.totalCount}
          onChange={(e) => onTotalCountChange(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={disabled}
        />
      </div>

      {/* Weight / loss */}
      <div className="rounded-md border p-4 space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          {t('totalWeight')}
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t('totalWeight')}</p>
            <p className="font-medium">{totalWeight.toFixed(1)}g</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('weightPerPieceBeforeLoss')}</p>
            <p className="font-medium">{weightPerPiece.toFixed(2)}g</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('lossAmountPerPiece')}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-8"
              value={lossPerPiece > 0 ? lossPerPiece.toFixed(2) : ''}
              placeholder="0.00"
              onChange={(e) => {
                const lpp = parseFloat(e.target.value) || 0;
                const newFinal = weightPerPiece - lpp;
                const newLoss = lpp * state.totalCount;
                onFinalWeightChange(newFinal > 0 ? newFinal : null);
                onLossAmountChange(newLoss > 0 ? newLoss : null);
              }}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('finalWeight')}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-8"
              value={finalWeightPerPiece > 0 ? finalWeightPerPiece.toFixed(2) : ''}
              placeholder="0.00"
              onChange={(e) => {
                const fw = parseFloat(e.target.value) || 0;
                const lpp = weightPerPiece - fw;
                onFinalWeightChange(fw > 0 ? fw : null);
                onLossAmountChange(lpp > 0 ? lpp * state.totalCount : null);
              }}
              disabled={disabled}
            />
          </div>
        </div>
        {lossRate > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('lossRate')}: {lossRate.toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}
