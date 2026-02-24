/**
 * Loading State Component
 * Shows while history is loading
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useTranslations } from 'next-intl';

export function LoadingState() {
  const t = useTranslations();

  return (
    <Card className="bg-gray-50 shadow-none border-none">
      <CardHeader>
        <CardTitle>{t('Cost.history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Spinner />
      </CardContent>
    </Card>
  );
}

