/**
 * Ingredient Select Trigger Button
 * Button component for selecting an ingredient/product
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface IngredientSelectTriggerProps {
  onSelect: () => void;
  className?: string;
}

export function IngredientSelectTrigger({
  onSelect,
  className,
}: IngredientSelectTriggerProps) {
  const t = useTranslations();

  return (
    <Button
      className={cn('px-3 py-1 h-7 rounded-sm text-xs', className)}
      onClick={onSelect}
    >
      {t('UI.select')}
    </Button>
  );
}

