import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import CostTable from '@/features/cost/components/CostTable';

const CostListPage = async () => {
  const t = await getTranslations('Cost');

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-3xl max-sm:text-2xl font-extrabold max-sm:hidden">
          {t('costs')}
        </h3>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/cost/new">
            <Plus className="h-4 w-4" />
            {t('newCost')}
          </Link>
        </Button>
      </div>
      <CostTable />
    </div>
  );
};

export default CostListPage;
