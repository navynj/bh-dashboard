import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { CostEditorStateWithHandlers } from '@/features/cost/types/cost';

interface TotalCostAreaProps {
  cost: CostEditorStateWithHandlers;
  totalCost: number;
  pricePerProduct: number;
}

const TotalCostArea = ({
  cost,
  totalCost,
  pricePerProduct,
}: TotalCostAreaProps) => {
  const t = useTranslations();

  return (
    <div className="bg-primary text-white content-box p-6 rounded-md h-fit items-center space-y-8">
      <div>
        <Label className="text-gray-400 font-bold text-xs">
          {t('Cost.totalCost')}
        </Label>
        <p className="text-2xl">${totalCost?.toFixed(2)}</p>
      </div>

      <div className="relative">
        <p className="absolute -left-2.5 top-4/7 text-gray-400 text-sm">/</p>
        <Label className="text-gray-400 font-bold text-xs">
          {t('Cost.totalCount')}
        </Label>
        <p className="text-2xl">{cost?.totalCount ?? 0}</p>
      </div>

      <div className="relative py-1 px-2 bg-white/10 rounded-lg w-full">
        <p className="absolute -left-3.5 top-1/2 text-gray-400 text-sm">=</p>
        <Label className="text-gray-400 font-bold text-xs">
          {t('Cost.unitPrice')}
        </Label>
        <p className="text-2xl">${pricePerProduct?.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default TotalCostArea;
