/**
 * Empty State Component
 * Shows when there's no history
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export function EmptyState() {
  const t = useTranslations();

  return (
    <Card className="bg-gray-50 shadow-none border-none">
      <CardHeader>
        <CardTitle>{t('Cost.history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">{t('Cost.history.noHistory')}</p>
      </CardContent>
    </Card>
  );
}

