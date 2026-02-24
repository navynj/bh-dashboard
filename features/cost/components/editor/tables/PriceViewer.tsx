'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UNIT_PRICE } from '@/constants/cost/cost';
import { useTranslations } from 'next-intl';
import { PriceEditorItem } from '@/features/cost/types/cost';

interface PriceViewerProps {
  idx: number;
  unitPrice: number;
  prices: Partial<PriceEditorItem>[];
  price: Partial<PriceEditorItem>;
}

const PriceViewer = ({ idx, unitPrice, prices, price }: PriceViewerProps) => {
  const t = useTranslations();

  return (
    <li className="space-y-2 rounded-md border p-2">
      <div className="flex gap-2">{price.title}</div>
      <Table>
        <TableHeader>
          <TableRow className="[&_th]:h-6 [&_th]:text-xs">
            <TableHead>{t('Cost.basePrice')}</TableHead>
            <TableHead></TableHead>
            <TableHead>{t('Cost.profitMarginRate')}</TableHead>
            <TableHead></TableHead>
            <TableHead>{t('Cost.sellingPrice')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              <Select value={price.base || UNIT_PRICE}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unitPrice">
                    {t('Cost.unitPrice')}
                  </SelectItem>
                  {idx > 0 &&
                    prices
                      .filter((item) => item?.id !== price.id)
                      .map((price) => (
                        <SelectItem key={price?.id} value={price?.id || ''}>
                          {price?.title}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="px-0 text-muted-foreground">+</TableCell>
            <TableCell>{price.margin}</TableCell>
            <TableCell className="px-0 text-muted-foreground">=</TableCell>
            <TableCell>{price.price}</TableCell>
          </TableRow>
          {/* <TableRow className="text-muted-foreground">
            <TableCell colSpan={3}>원가 대비 마진율</TableCell>
          </TableRow> */}
        </TableBody>
      </Table>
    </li>
  );
};

export default PriceViewer;
