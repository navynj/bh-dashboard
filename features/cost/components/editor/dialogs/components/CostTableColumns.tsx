/**
 * Cost Table Columns
 * Column definitions for the cost selection table in IngredientSelectDialog
 */

import { createColumnHelper } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/DataTableColumnHeader';
import TagBadge from '@/features/cost/components/editor/tags/TagBadge';
import { CostApiResponse } from '@/features/cost/types/cost';
import {
  renderUnitPrice,
  renderDefinedPrices,
  renderFinalPrice,
  formatPrice,
} from '../../../utils/priceHelpers';

type CostWithGPrice = CostApiResponse & { gPrice?: number | null };

export const costColumnHelper = createColumnHelper<CostWithGPrice>();

interface CreateCostColumnsParams {
  tagOptions: string[];
  allTags: Array<{ id: string; name: string }>;
  onSelect: (cost: CostApiResponse) => void;
  SelectTrigger: React.ComponentType<{
    onSelect: () => void;
    className?: string;
  }>;
  // Optional: all costs data to extract unique price titles for dynamic columns
  allCosts?: CostWithGPrice[];
}

/**
 * Creates columns for the cost selection table
 */
export function createCostColumns({
  tagOptions,
  allTags,
  onSelect,
  SelectTrigger,
  allCosts = [],
}: CreateCostColumnsParams) {
  const columns = [
    costColumnHelper.accessor('title', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cost.title" />
      ),
      cell: ({ getValue }) => getValue(),
    }),
    costColumnHelper.accessor('tags', {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Cost.tags"
          options={tagOptions}
        />
      ),
      cell: ({ getValue }) => {
        const tags = getValue();
        return (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>
        );
      },
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        // Filter by tag name (filterValue is the tag name)
        if (!filterValue) return true;
        const tags = row.getValue(columnId) as typeof allTags;
        return tags.some((tag) => tag.name === filterValue);
      },
    }),
    // Unit Price column
    // costColumnHelper.accessor((row) => row, {
    //   id: 'unitPrice',
    //   header: ({ column }) => (
    //     <DataTableColumnHeader column={column} title="Cost.unitPrice" />
    //   ),
    //   cell: ({ getValue }) => renderUnitPrice(getValue()),
    // }),
    // Final Price column
    costColumnHelper.accessor((row) => row, {
      id: 'finalPrice',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cost.finalPrice" />
      ),
      cell: ({ getValue }) => renderFinalPrice(getValue()),
      enableSorting: false,
    }),
    // Price column - displays defined prices (Wholesale, MSRP, etc.)
    // costColumnHelper.accessor((row) => row, {
    //   id: 'prices',
    //   header: ({ column }) => (
    //     <DataTableColumnHeader column={column} title="Cost.price" />
    //   ),
    //   cell: ({ getValue }) => renderDefinedPrices(getValue()),
    //   enableSorting: false,
    // }),
    // Weight column
    costColumnHelper.accessor((row) => row, {
      id: 'finalWeight',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cost.finalWeight" />
      ),
      cell: ({ getValue }) => {
        const cost = getValue() as CostWithGPrice;
        // If finalWeight exists, use it
        if (cost.finalWeight !== null && cost.finalWeight !== undefined) {
          return formatPrice(cost.finalWeight);
        }
        // Otherwise, calculate from (totalWeight - lossAmount) / totalCount
        // totalWeight is sum of ingredients' amount
        const ingredients = cost.ingredients || [];
        const totalWeight = ingredients.reduce(
          (acc: number, ingredient: { amount?: number }) =>
            acc + (ingredient.amount || 0),
          0
        );
        const lossAmount = cost.lossAmount || 0;
        const totalCount = cost.totalCount || 0;

        if (totalCount > 0) {
          const calculatedFinalWeight = (totalWeight - lossAmount) / totalCount;
          return formatPrice(calculatedFinalWeight);
        }

        return formatPrice(null);
      },
    }),
    costColumnHelper.accessor('gPrice', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cost.gPrice" />
      ),
      // gPrice is per 1g, but column title says "per 100g", so multiply by 100
      cell: ({ getValue }) => {
        const gPrice = getValue();
        return formatPrice(
          gPrice !== null && gPrice !== undefined ? gPrice * 100 : null
        );
      },
    }),
    costColumnHelper.accessor('id', {
      id: 'select',
      header: ({ column }) => <DataTableColumnHeader column={column} />,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        return (
          <SelectTrigger
            onSelect={() => {
              onSelect(row.original);
            }}
          />
        );
      },
    }),
  ];

  return columns;
}
