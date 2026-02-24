import { DataTable } from '@/components/ui/data-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Dispatch, SetStateAction, useCallback, useMemo } from 'react';
import {
  CostEditorStateWithHandlers,
  IngredientEditorItem,
  IngredientEditorItemWithHandlers,
} from '@/features/cost/types/cost';
import { useTranslations } from 'next-intl';
import { calculatePackagingTotal } from '../../utils/calculations/calculations';
import { createNewPackaging } from '../../utils/itemFactories';
import { useTotalCost } from '../../hooks/table/useCostTable';
import {
  createImageEditorColumn,
  createPriceDisplayEditorColumn,
  createAmountEditorColumn,
  createDeleteButtonColumn,
  createFieldUpdaters,
  createIngredientSelectColumn,
} from '../../utils/tableConfig';
import { createPackagingHandlers } from '../../utils/handlers/handlers';
import { DragEndEvent } from '@dnd-kit/core';
import { reorderItemsWithRanks } from '../../utils/rankUtils';

interface PackagingTableProps {
  cost: CostEditorStateWithHandlers;
  setCost: Dispatch<SetStateAction<CostEditorStateWithHandlers>>;
  totalCost: number;
  setTotalCost: Dispatch<SetStateAction<number>>;
  setData: Dispatch<SetStateAction<IngredientEditorItemWithHandlers[]>>;
  disabled?: boolean;
}

const createColumns = (
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
      headerKey: 'Cost.title',
      isPackaging: true,
      disabled,
    }),
    createAmountEditorColumn({
      c,
      accessor: 'amount',
      headerKey: 'Cost.pcsAmount',
      setAmount: (id: string, amount: number) => {
        const handlers = createPackagingHandlers(id, setData);
        handlers.setAmount(amount);
      },
      inputMode: 'numeric',
      disabled,
    }),
    createPriceDisplayEditorColumn({
      c,
      accessor: 'unitPrice',
      headerKey: 'Cost.unitPrice',
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

const PackagingTable = ({
  cost,
  setCost,
  totalCost,
  setTotalCost,
  setData,
  disabled,
}: PackagingTableProps) => {
  // ============================================================================
  // Basic Hooks
  // ============================================================================
  const t = useTranslations();

  // ============================================================================
  // Custom Hooks
  // ============================================================================
  useTotalCost({
    items: cost.packagings ?? [],
    calculateTotal: calculatePackagingTotal,
    onTotalChange: setTotalCost,
  });

  // ============================================================================
  // Memoized Values
  // ============================================================================
  const currentCostId = useMemo(() => cost.id, [cost.id]);

  const columns = useMemo(
    () => createColumns(setData, disabled),
    [setData, disabled]
  );

  // ============================================================================
  // Callbacks & Handlers
  // ============================================================================
  const addPackagingHandler = useCallback(() => {
    const newPackaging = createNewPackaging(currentCostId, setData);
    setData((prev) => [...prev, newPackaging]);
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

  return (
    <>
      <div>
        <h3 className="font-extrabold text-lg">{t('Cost.packaging')}</h3>
        <p className="text-2xl font-light break-all">${totalCost.toFixed(2)}</p>
      </div>
      <DataTable
        columns={columns}
        data={cost.packagings ?? []}
        addNewRow={addPackagingHandler}
        hideNoResults={true}
        hideViewOptions={true}
        isFetching={false}
        disabled={disabled}
        enableDragAndDrop={true}
        disableSorting={true}
        disableHiding={true}
        onDragEnd={handleDragEnd}
      />
    </>
  );
};

export default PackagingTable;
