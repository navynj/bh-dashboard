'use client';

import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/DataTableColumnHeader';
import { useUserQuery } from '@/features/user/hooks/useUserQuery';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTotalCost } from '../../hooks/table/useCostTable';
import { useGPerPcUpdate } from '../../hooks/editor/useGPerPcUpdate';
import {
  CostEditorStateWithHandlers,
  IngredientEditorItem,
  IngredientEditorItemWithHandlers,
} from '@/features/cost/types/cost';
import { calculateIngredientTotal } from '../../utils/calculations/calculations';
import { createIngredientHandlers } from '../../utils/handlers/handlers';
import { createNewIngredient } from '../../utils/itemFactories';
import {
  createAmountEditorColumn,
  createDeleteButtonColumn,
  createFieldUpdaters,
  createGPriceEditorColumn,
  createGPriceErrorRowClassName,
  createImageEditorColumn,
  createIngredientSelectColumn,
  createIsAmountDisabled,
  createPriceDisplayEditorColumn,
  createTextDisplayColumn,
} from '../../utils/tableConfig';
import GPerPcDialog from '../dialogs/GPerPcDialog';
import { getNextRank, reorderItemsWithRanks } from '../../utils/rankUtils';
import { DragEndEvent } from '@dnd-kit/core';

interface IngredientTableProps {
  cost: CostEditorStateWithHandlers;
  setCost: Dispatch<SetStateAction<CostEditorStateWithHandlers>>;
  totalCost: number;
  setTotalCost: Dispatch<SetStateAction<number>>;
  setData: Dispatch<SetStateAction<IngredientEditorItemWithHandlers[]>>;
  organizationId?: string;
  disabled?: boolean;
}

const createColumns = (
  t: ReturnType<typeof useTranslations>,
  onGPerPcClick: (ingredient: IngredientEditorItemWithHandlers) => void,
  setData: Dispatch<SetStateAction<IngredientEditorItemWithHandlers[]>>,
  disabled?: boolean
) => {
  const c = createColumnHelper<IngredientEditorItemWithHandlers>();

  // Create field updaters
  const updaters = createFieldUpdaters<
    IngredientEditorItem,
    IngredientEditorItemWithHandlers
  >(setData);

  return [
    createImageEditorColumn({
      c,
      headerKey: 'Cost.image',
    }),
    createIngredientSelectColumn({
      c,
      headerKey: 'Cost.ingredientTitle',
      isPackaging: false,
      getCurrentCostId: (table) => (table.options.meta as any)?.currentCostId,
      disabled,
    }),
    // createTextDisplayColumn({
    //   c,
    //   accessor: 'unit',
    //   headerKey: 'Product.unit',
    //   id: 'unit',
    // }),
    // createTextDisplayColumn({
    //   c,
    //   accessor: (row: IngredientEditorItemWithHandlers) =>
    //     row.metadata?.pak_unit,
    //   headerKey: 'Product.pakUnit',
    //   id: 'pak',
    // }),
    // createTextDisplayColumn({
    //   c,
    //   accessor: (row: IngredientEditorItemWithHandlers) =>
    //     row.metadata?.split_unit,
    //   headerKey: 'Product.splitUnit',
    //   id: 'split',
    // }),
    createAmountEditorColumn({
      c,
      accessor: 'amount',
      headerKey: 'Cost.gramAmount',
      setAmount: (id: string, amount: number) => {
        const handlers = createIngredientHandlers(id, setData);
        handlers.setAmount(amount);
      },
      isDisabled: createIsAmountDisabled<IngredientEditorItemWithHandlers>(),
      disabled,
    }),
    createGPriceEditorColumn({
      c,
      t,
      onGPerPcClick,
      getRowClassName:
        createGPriceErrorRowClassName<IngredientEditorItemWithHandlers>([
          'Packaging',
        ]),
      headerKey: 'Cost.gPrice',
    }),
    c.accessor((row: IngredientEditorItemWithHandlers) => row.metadata?.g_per_pc, {
      id: 'gPerPc',
      header: ({ column }: any) => (
        <DataTableColumnHeader column={column} title="Cost.gPerPc" />
      ),
      cell: ({ getValue }: any) => {
        const gPerPc = getValue() as number | null | undefined;
        if (gPerPc === null || gPerPc === undefined || gPerPc === 0) {
          return <p>-</p>;
        }
        return <p>{gPerPc}</p>;
      },
    }),
    createPriceDisplayEditorColumn({
      c,
      accessor: 'amountPrice',
      headerKey: 'Cost.amountPrice',
    }),
    createDeleteButtonColumn({
      c,
      removeHandler: updaters.createRemover(),
      disabled,
    }),
  ];
};

const IngredientTable = ({
  cost,
  totalCost,
  setTotalCost,
  setData,
  organizationId,
  disabled,
}: IngredientTableProps) => {
  // ============================================================================
  // Basic Hooks
  // ============================================================================
  const t = useTranslations();
  const { data: user } = useUserQuery();

  // ============================================================================
  // State Hooks
  // ============================================================================
  const [dialogOpen, setDialogOpen] = useState(false);

  // ============================================================================
  // Custom Hooks
  // ============================================================================
  const { selectedIngredient, setSelectedIngredient, handleSaveGPerPc } =
    useGPerPcUpdate(organizationId, setData);

  useTotalCost({
    items: cost.ingredients ?? [],
    calculateTotal: calculateIngredientTotal,
    onTotalChange: setTotalCost,
  });

  // ============================================================================
  // Memoized Values
  // ============================================================================
  // Get current cost ID from props (memoized to avoid unnecessary recalculations)
  const currentCostId = useMemo(() => cost.id, [cost.id]);
  const tableMeta = useMemo(() => ({ currentCostId }), [currentCostId]);

  // ============================================================================
  // Callbacks & Handlers
  // ============================================================================
  const handleGPerPcClick = useCallback(
    (ingredient: IngredientEditorItemWithHandlers) => {
      if (!ingredient.variantId || !organizationId) {
        return;
      }
      setSelectedIngredient(ingredient);
      setDialogOpen(true);
    },
    [organizationId, setSelectedIngredient]
  );

  const addIngredientHandler = useCallback(() => {
    const newIngredient = createNewIngredient(currentCostId, setData);
    setData((prev) => {
      console.log('prev', { newIngredient, prev, rank: getNextRank(prev) });
      return [
        ...prev,
        {
          ...newIngredient,
          rank: getNextRank(prev),
        },
      ];
    });
  }, [currentCostId, setData]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setData((prev) => {
        const reordered = reorderItemsWithRanks(event, prev);
        return reordered ?? prev;
      });
    },
    [setData]
  );

  const columns = useMemo(
    () => createColumns(t, handleGPerPcClick, setData, disabled),
    [t, handleGPerPcClick, setData, disabled]
  );

  // ============================================================================
  // Effects
  // ============================================================================
  useEffect(() => {
    if (!dialogOpen) {
      setSelectedIngredient(null);
    }
  }, [dialogOpen, setSelectedIngredient]);

  return (
    <>
      <div>
        <h3 className="font-extrabold text-lg">{t('Cost.ingredients')}</h3>
        <p className="text-2xl font-light break-all">${totalCost.toFixed(2)}</p>
      </div>
      <DataTable
        columns={columns}
        data={cost.ingredients ?? []}
        addNewRow={addIngredientHandler}
        hideNoResults={true}
        isFetching={false}
        hideViewOptions={true}
        disabled={disabled}
        tableMeta={tableMeta}
        enableDragAndDrop={true}
        disableSorting={true}
        disableHiding={true}
        onDragEnd={handleDragEnd}
      />
      <GPerPcDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentValue={selectedIngredient?.metadata?.g_per_pc}
        productTitle={selectedIngredient?.title}
        onSave={handleSaveGPerPc}
      />
    </>
  );
};

export default IngredientTable;
