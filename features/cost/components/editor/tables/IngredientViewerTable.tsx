'use client';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/DataTableColumnHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProductType } from '@/features/product/types';
import { useUserQuery } from '@/features/user/hooks/useUserQuery';
import { createColumnHelper } from '@tanstack/react-table';
import { useAtomValue } from 'jotai';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState } from 'react';
import IngredientSelectDialog from '../dialogs/IngredientSelectDialog';
import PriceViewer from './PriceViewer';
import {
  CostEditorStateWithHandlers,
  IngredientEditorItemWithHandlers,
} from '@/features/cost/types/cost';

interface IngredientHandlers {
  setAmount: (amount: number) => void;
  setIngredient: (item: ProductType) => void;
  removeIngredient: (id: string) => void;
}

const c = createColumnHelper<IngredientEditorItemWithHandlers>();

const columns = [
  c.accessor('image', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost.image" />
    ),
    cell: ({ getValue, row }) => {
      const image = getValue();
      return (
        image && (
          <Image
            className="rounded-md"
            src={image.src}
            alt={image.alt || row.original.title + ' ' + 'File.image'}
            width={36}
            height={36}
            priority={false}
          />
        )
      );
    },
  }),
  c.accessor('title', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost.ingredientTitle" />
    ),
    cell: ({ getValue, row }) => {
      return (
        <IngredientSelectDialog
          selectedName={getValue()}
          setIngredient={row.original.setIngredient}
          isNew={!row.original.isSelected}
        />
      );
    },
  }),
  c.accessor('amount', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost.amount" />
    ),
    cell: ({ row, getValue }) => (
      <Input
        id={`${row.original.id}-amount`}
        type="number"
        className="w-[100px]"
        value={getValue()}
        onChange={(e) => {
          row.original.setAmount && row.original.setAmount(+e.target.value);
        }}
      />
    ),
  }),
  c.accessor('unit', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost.unit" />
    ),
  }),
  c.accessor('unitPrice', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost.unitPrice" />
    ),
    cell: ({ getValue }) =>
      getValue() > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <p>{(+getValue()).toFixed(2)}</p>
          </TooltipTrigger>
          <TooltipContent>{+getValue()}</TooltipContent>
        </Tooltip>
      ) : (
        (+getValue()).toFixed(2)
      ),
  }),
  c.accessor('amountPrice', {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost.amountPrice" />
    ),
    cell: ({ getValue }) =>
      getValue() > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <p>{(+getValue()).toFixed(2)}</p>
          </TooltipTrigger>
          <TooltipContent>{+getValue()}</TooltipContent>
        </Tooltip>
      ) : (
        (+getValue()).toFixed(2)
      ),
  }),
  c.accessor('removeIngredient', {
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    cell: ({ getValue, row }) => (
      <Button
        variant="ghost"
        className="opacity-50 px-2"
        onClick={() => getValue() && getValue()(row.original.id as string)}
      >
        <Trash2 size={16} />
      </Button>
    ),
  }),
];

interface IngredientViewerTableProps {
  cost: CostEditorStateWithHandlers;
}

const IngredientViewerTable = ({ cost }: IngredientViewerTableProps) => {
  const t = useTranslations();

  const { data: user } = useUserQuery();

  const [totalCost, setTotalCost] = useState(0);
  const [pricePerProduct, setPricePerProduct] = useState(0);
  const [filter, setFilter] = useState('');

  return (
    <div className="space-y-4 w-full">
      <DataTable
        columns={columns}
        data={cost.ingredients}
        hideNoResults={true}
        isFetching={false}
      />
      <div className="flex gap-4">
        <div className="rounded-md border p-6 flex w-full h-fit items-center">
          <div>
            <Label className="text-gray-400 font-bold text-xs">
              {t('Cost.totalCost')}
            </Label>
            <p className="text-2xl">${totalCost?.toFixed(2)}</p>
          </div>
          <p className="text-gray-400 px-8">/</p>
          <div>
            <Label className="text-gray-400 font-bold text-xs">
              {t('Cost.totalCount')}
            </Label>
            {cost.totalCount}
          </div>
          <p className="text-gray-400 px-8">=</p>
          <div className="py-1 px-2 bg-gray-50 rounded-lg w-full">
            <Label className="text-gray-400 font-bold text-xs">
              {t('Cost.unitPrice')}
            </Label>
            <p className="text-2xl">${pricePerProduct.toFixed(2)}</p>
          </div>
        </div>
        <div className="w-2/5 sm:w-full flex flex-col items-center justify-between space-y-10">
          <ul className="space-y-4">
            {cost.prices.map((item, i) => (
              <PriceViewer
                key={item.id}
                idx={i}
                unitPrice={pricePerProduct}
                prices={cost.prices}
                price={item}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default IngredientViewerTable;
