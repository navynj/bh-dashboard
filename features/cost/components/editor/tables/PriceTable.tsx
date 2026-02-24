'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Switch } from '@/components/ui/switch';
import { UNIT_PRICE } from '@/constants/cost/cost';
import { translateErrorMessage } from '@/utils/error';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, type ChangeEvent } from 'react';
import { PriceEditorItem } from '@/features/cost/types/cost';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PriceTableProps {
  idx: number;
  unitPrice: number;
  prices: Partial<PriceEditorItem>[];
  price: Partial<PriceEditorItem>;
  setPrice: (price: Partial<PriceEditorItem>) => void;
  updatePrices: (id: string) => void;
  formError?: any;
  disabled?: boolean;
  onFinalPriceChange?: (priceId: string, isFinalPrice: boolean) => void;
}

const PriceTable = ({
  idx,
  unitPrice,
  prices,
  price,
  setPrice,
  updatePrices,
  formError,
  disabled,
  onFinalPriceChange,
}: PriceTableProps) => {
  // ============================================================================
  // Basic Hooks
  // ============================================================================
  const t = useTranslations();

  // ============================================================================
  // Memoized Values
  // ============================================================================
  const isEmpty = useMemo(
    () => !price.title || price.title.trim() === '',
    [price.title],
  );

  const errorMessage = useMemo(
    () => translateErrorMessage(formError?.message, t),
    [formError?.message, t],
  );

  const hasError = useMemo(() => isEmpty || !!formError, [isEmpty, formError]);

  // Helper function to get base price
  const getBasePrice = useCallback(
    (baseId = price.base) => {
      if (baseId === UNIT_PRICE || !price.base) {
        return unitPrice;
      } else {
        const priceInfo = prices.find((item) => item?.id === baseId);

        if (!priceInfo?.price && priceInfo?.price !== 0) {
          console.error('Price info not exists');
          return 0;
        } else {
          return +priceInfo.price;
        }
      }
    },
    [price.base, prices, unitPrice],
  );

  // ============================================================================
  // Callbacks & Handlers
  // ============================================================================
  // Note: These handlers don't use useCallback to avoid infinite loops
  // since setPrice doesn't support functional updates and price object changes frequently
  const nameChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setPrice({ ...price, title: e.target.value });
  };

  const deleteHandler = () => {
    setPrice({});
  };

  const marginChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    const marginNum = +e.target.value;
    const margin = isNaN(marginNum) ? 0 : marginNum;

    if (isNaN(margin)) {
      return;
    }

    const basePrice = getBasePrice();

    setPrice({
      ...price,
      margin,
      price: basePrice + basePrice * (margin / 100),
    });
  };

  const priceChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    const sellingPrice = +e.target.value;
    const basePrice = getBasePrice();

    const margin =
      basePrice !== 0 ? ((sellingPrice - basePrice) / basePrice) * 100 : 0;
    setPrice({
      ...price,
      margin: margin,
      price: sellingPrice,
    });
  };

  const baseChangeHandler = (value: string) => {
    const basePrice = getBasePrice(value);

    const marginNum = +(price.margin || 0);
    const margin = isNaN(marginNum) ? 0 : marginNum;

    setPrice({
      ...price,
      base: value,
      price: basePrice + basePrice * (margin / 100),
    });
  };

  const finalPriceChangeHandler = (checked: boolean) => {
    if (onFinalPriceChange && price.id) {
      onFinalPriceChange(price.id, checked);
    } else {
      setPrice({
        ...price,
        isFinalPrice: checked,
      });
    }
  };

  // ============================================================================
  // Effects
  // ============================================================================
  useEffect(() => {
    if (price.id) {
      updatePrices(price.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price.price]); // Only update when price.price changes, not when updatePrices changes

  return (
    <li className="space-y-2 rounded-md border p-2">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2 items-center flex-1">
          {disabled ? (
            <p className="text-lg font-extrabold">{price.title}</p>
          ) : (
            <Input
              className="text-lg font-extrabold"
              value={price.title}
              placeholder={t('Cost.enterPriceName')}
              onChange={nameChangeHandler}
              error={errorMessage || hasError}
              disabled={disabled}
            />
          )}
          {idx > 0 && !disabled && (
            <Button
              variant="ghost"
              className="px-2"
              onClick={deleteHandler}
              disabled={disabled}
            >
              <Trash2 className="opacity-30" />
            </Button>
          )}
        </div>
        {!disabled && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              {t('Cost.finalPrice')}
            </label>
            <Switch
              checked={price.isFinalPrice || false}
              onCheckedChange={finalPriceChangeHandler}
              disabled={disabled}
            />
          </div>
        )}
      </div>
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
              {disabled ? (
                <p>
                  {prices.find((item) => item?.id === price.base)?.title ||
                    t('Cost.unitPrice')}
                </p>
              ) : (
                <Select
                  value={price.base || UNIT_PRICE}
                  onValueChange={baseChangeHandler}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-40" disabled={disabled}>
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
              )}
            </TableCell>
            <TableCell className="px-0 text-muted-foreground">+</TableCell>
            <TableCell>
              {disabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p>{price.margin?.toFixed(2)}</p>
                  </TooltipTrigger>
                  <TooltipContent>{price.margin}</TooltipContent>
                </Tooltip>
              ) : (
                <Input
                  className="w-16"
                  type="number"
                  value={price.margin}
                  onChange={marginChangeHandler}
                  disabled={disabled}
                />
              )}
            </TableCell>
            <TableCell className="px-0 text-muted-foreground">=</TableCell>
            <TableCell>
              {disabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p>{price.price?.toFixed(2)}</p>
                  </TooltipTrigger>
                  <TooltipContent>{price.price}</TooltipContent>
                </Tooltip>
              ) : (
                <Input
                  className="w-20"
                  type="number"
                  value={price.price}
                  onChange={priceChangeHandler}
                  disabled={disabled}
                />
              )}
            </TableCell>
          </TableRow>
          {/* <TableRow className="text-muted-foreground">
            <TableCell colSpan={3}>원가 대비 마진율</TableCell>
          </TableRow> */}
        </TableBody>
      </Table>
    </li>
  );
};

export default PriceTable;
