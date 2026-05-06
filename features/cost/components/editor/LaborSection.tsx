'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LaborEditorItem } from '../../types/cost';

interface Props {
  labors: LaborEditorItem[];
  disabled?: boolean;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<LaborEditorItem>) => void;
  onRemove: (id: string) => void;
}

export default function LaborSection({ labors, disabled, onAdd, onUpdate, onRemove }: Props) {
  const t = useTranslations('Cost');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{t('labor')}</h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onAdd}
          disabled={disabled}
        >
          <Plus className="h-3 w-3" />
          {t('addLabor')}
        </Button>
      </div>

      {labors.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[40%]">
                  {t('title')}
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[15%]">
                  {t('laborTime')}(h)
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[12%]">
                  {t('people')}
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[18%]">
                  {t('wage')}($/h)
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[12%]">
                  {t('cost')}
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {labors.map((labor, idx) => {
                const cost = labor.time * labor.people * labor.wage;
                return (
                  <tr key={labor.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-2 py-1">
                      <Input
                        className="h-7 text-xs"
                        placeholder={t('laborTitle')}
                        value={labor.title}
                        onChange={(e) => onUpdate(labor.id, { title: e.target.value })}
                        disabled={disabled}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        className="h-7 text-xs text-right"
                        value={labor.time || ''}
                        placeholder="0"
                        onChange={(e) =>
                          onUpdate(labor.id, { time: parseFloat(e.target.value) || 0 })
                        }
                        disabled={disabled}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        min={1}
                        className="h-7 text-xs text-right"
                        value={labor.people || ''}
                        placeholder="1"
                        onChange={(e) =>
                          onUpdate(labor.id, {
                            people: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        disabled={disabled}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-7 text-xs text-right"
                        value={labor.wage || ''}
                        placeholder="0.00"
                        onChange={(e) =>
                          onUpdate(labor.id, { wage: parseFloat(e.target.value) || 0 })
                        }
                        disabled={disabled}
                      />
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums font-medium">
                      ${cost.toFixed(2)}
                    </td>
                    <td className="px-1 py-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(labor.id)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
