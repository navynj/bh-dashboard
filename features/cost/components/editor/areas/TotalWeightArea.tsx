import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import React, { useMemo } from 'react';
import { CostEditorStateWithHandlers } from '@/features/cost/types/cost';

interface TotalWeightAreaProps {
  cost: CostEditorStateWithHandlers;
  setCost: React.Dispatch<React.SetStateAction<CostEditorStateWithHandlers>>;
  disabled?: boolean;
}

const TotalWeightArea = ({ cost, setCost, disabled }: TotalWeightAreaProps) => {
  const t = useTranslations();

  // Calculate total weight of all ingredients in grams
  // Note: amount is always in grams (g), no conversion needed
  const totalWeight = useMemo(() => {
    return (cost?.ingredients ?? []).reduce((acc, ingredient) => {
      return acc + (ingredient.amount || 0);
    }, 0);
  }, [cost?.ingredients]);

  // Calculate weight per piece (before loss)
  const weightPerPieceBeforeLoss =
    cost?.totalCount && cost?.totalCount > 0
      ? totalWeight / cost?.totalCount
      : 0;

  // Get current values
  const finalWeight = cost?.finalWeight || 0;
  const lossAmount = cost?.lossAmount || 0;

  // Calculate derived values
  // If finalWeight is set, calculate lossAmount per piece, then total lossAmount
  // If lossAmount is set, calculate finalWeight per piece
  const lossAmountPerPiece =
    lossAmount > 0 && cost?.totalCount && cost?.totalCount > 0
      ? lossAmount / cost?.totalCount
      : finalWeight > 0 && weightPerPieceBeforeLoss > 0
      ? weightPerPieceBeforeLoss - finalWeight
      : 0;

  const finalWeightPerPiece =
    finalWeight > 0
      ? finalWeight
      : lossAmountPerPiece > 0 && weightPerPieceBeforeLoss > 0
      ? weightPerPieceBeforeLoss - lossAmountPerPiece
      : weightPerPieceBeforeLoss;

  const totalLossAmount =
    lossAmountPerPiece > 0 && cost?.totalCount && cost?.totalCount > 0
      ? lossAmountPerPiece * cost?.totalCount
      : 0;

  // Loss rate (read-only)
  const lossRate =
    totalWeight > 0 && totalLossAmount > 0
      ? (totalLossAmount / totalWeight) * 100
      : 0;

  return (
    <div className="rounded-md border p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div>
          <Label className="text-gray-400 font-bold text-xs">
            {t('Cost.totalWeight')}
          </Label>
          <p>{totalWeight.toFixed(2)}</p>
        </div>
        <p className="text-gray-400 px-4">/</p>
        <div>
          <Label className="text-gray-400 font-bold text-xs">
            {t('Cost.totalCount')}
          </Label>
          <p>{cost?.totalCount}</p>
        </div>
        <p className="text-gray-400 px-4">=</p>
        <div>
          <Label className="text-gray-400 font-bold text-xs">
            {t('Cost.weightPerPieceBeforeLoss')}
          </Label>
          <p>{weightPerPieceBeforeLoss.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <Label className="text-gray-400 font-bold text-xs">
            {t('Cost.weightPerPieceBeforeLoss')}
          </Label>
          <p>{weightPerPieceBeforeLoss.toFixed(2)}</p>
        </div>
        <p className="text-gray-400 px-4">-</p>
        <div>
          <Label className="text-gray-400 font-bold text-xs">
            {t('Cost.lossAmountPerPiece')}
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-8 w-32"
            value={lossAmountPerPiece > 0 ? lossAmountPerPiece.toFixed(2) : ''}
            onChange={(e) => {
              const lossPerPiece = +e.target.value || 0;
              const newFinalWeight = weightPerPieceBeforeLoss - lossPerPiece;
              const newLossAmount = lossPerPiece * (cost?.totalCount ?? 0);
              setCost((prev) => {
                return {
                  ...prev,
                  lossAmount: newLossAmount,
                  finalWeight: newFinalWeight,
                };
              });
            }}
            placeholder="0.00"
            disabled={disabled}
          />
        </div>
        <p className="text-gray-400 px-4">=</p>
        <div>
          <Label className="text-gray-400 font-bold text-xs">
            {t('Cost.finalWeight')}
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            className="h-8 w-32"
            value={
              finalWeightPerPiece > 0 ? finalWeightPerPiece.toFixed(2) : ''
            }
            onChange={(e) => {
              const newFinalWeight = +e.target.value || 0;
              const newLossPerPiece = weightPerPieceBeforeLoss - newFinalWeight;
              const newLossAmount = newLossPerPiece * (cost?.totalCount ?? 0);
              setCost((prev) => {
                return {
                  ...prev,
                  finalWeight: newFinalWeight,
                  lossAmount: newLossAmount,
                };
              });
            }}
            placeholder="0.00"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2 border-t">
        <div>
          <Label className="text-gray-400 font-bold text-xs">
            {t('Cost.lossRate')}
          </Label>
          <p>{lossRate.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
};

export default TotalWeightArea;
