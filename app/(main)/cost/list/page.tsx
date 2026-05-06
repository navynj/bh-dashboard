import { getTranslations } from 'next-intl/server';
import CostTable from '@/features/cost/components/CostTable';

const CostListPage = async () => {
  const t = await getTranslations('Cost');

  return (
    <div className="w-full space-y-4">
      <h3 className="text-3xl max-sm:text-2xl font-extrabold max-sm:hidden">
        {t('costs')}
      </h3>
      <CostTable />
    </div>
  );
};

export default CostListPage;
