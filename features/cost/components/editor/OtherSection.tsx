'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { OtherEditorItem } from '../../types/cost';

interface Props {
  others: OtherEditorItem[];
  disabled?: boolean;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<OtherEditorItem>) => void;
  onRemove: (id: string) => void;
}

export default function OtherSection({ others, disabled, onAdd, onUpdate, onRemove }: Props) {
  const t = useTranslations('Cost');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{t('other')}</h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onAdd}
          disabled={disabled}
        >
          <Plus className="h-3 w-3" />
          {t('addOther')}
        </Button>
      </div>

      {others.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  {t('title')}
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-[160px]">
                  {t('amount')} ($)
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {others.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-2 py-1">
                    <Input
                      className="h-7 text-xs"
                      placeholder={t('otherTitle')}
                      value={item.title}
                      onChange={(e) => onUpdate(item.id, { title: e.target.value })}
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-7 text-xs text-right"
                      value={item.amount || ''}
                      placeholder="0.00"
                      onChange={(e) =>
                        onUpdate(item.id, { amount: parseFloat(e.target.value) || 0 })
                      }
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(item.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
