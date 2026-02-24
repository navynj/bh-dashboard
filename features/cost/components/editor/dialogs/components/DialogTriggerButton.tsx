/**
 * Dialog Trigger Button
 * Button that opens the ingredient selection dialog
 */

import { buttonVariants } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface DialogTriggerButtonProps {
  selectedName?: string;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function DialogTriggerButton({
  selectedName,
  disabled = false,
  onClick,
  onKeyDown,
}: DialogTriggerButtonProps) {
  const t = useTranslations();
  const selectedNameLength = selectedName?.length || 0;

  return (
    <div
      className={cn(
        buttonVariants({
          variant: 'outline',
          size: 'icon',
          className: cn(
            'font-medium px-2 w-full',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          ),
        })
      )}
      onClick={onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={onKeyDown}
    >
      {selectedName && selectedNameLength > 60 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-full text-left truncate">
              {selectedName.slice(0, 60)}
              {selectedNameLength > 60 && '..'}
            </span>
          </TooltipTrigger>
          <TooltipContent>{selectedName}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="w-full text-left">
          {selectedName || (
            <span className="text-gray-400">{t('UI.select')}</span>
          )}
        </span>
      )}
    </div>
  );
}

