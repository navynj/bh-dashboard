import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import React from 'react';
import { CostEditorStateWithHandlers } from '@/features/cost/types/cost';

interface TotalCountAreaProps {
  cost: CostEditorStateWithHandlers;
  setCost: React.Dispatch<React.SetStateAction<CostEditorStateWithHandlers>>;
  disabled?: boolean;
}

const TotalCountArea = ({ cost, setCost, disabled }: TotalCountAreaProps) => {
  const t = useTranslations();
  return (
    <div className="rounded-md border p-6">
      <div>
        <Label className="text-gray-400 font-bold text-xs">
          {t('Cost.totalCount')}
        </Label>
        <Input
          type="number"
          min={0}
          className="h-8 mt-2"
          value={cost?.totalCount ?? 0}
          onChange={(e) =>
            setCost((prev) => {
              return { ...prev, totalCount: +e.target.value };
            })
          }
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default TotalCountArea;
