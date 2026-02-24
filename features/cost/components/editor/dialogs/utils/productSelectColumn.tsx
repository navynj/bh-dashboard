/**
 * Product Select Column Utility
 * Creates a select column for product tables
 */

import { createColumnHelper } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/DataTableColumnHeader';
import { ProductType } from '@/features/product/types';
import { IngredientSelectTrigger } from '../components/IngredientSelectTrigger';

type IngredientType = ProductType & {
  selectIngredient: (product: ProductType) => void;
};

const c = createColumnHelper<IngredientType>();

/**
 * Creates a select column for product tables
 */
export function createProductSelectColumn(
  onSelect: (product: ProductType) => void,
  className?: string
) {
  return c.accessor('variantId', {
    id: 'select',
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      return (
        <IngredientSelectTrigger
          className={className}
          onSelect={() => {
            onSelect(row.original as ProductType);
          }}
        />
      );
    },
  });
}

