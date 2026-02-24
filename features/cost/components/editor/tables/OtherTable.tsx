'use client';

import { Dispatch, SetStateAction, useCallback, useMemo } from 'react';
import {
  CostEditorStateWithHandlers,
  OtherEditorItemWithHandlers,
  OtherEditorItem,
} from '@/features/cost/types/cost';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { useTranslations } from 'next-intl';
import { createOtherHandlers } from '../../utils/handlers/handlers';
import { calculateOtherTotal } from '../../utils/calculations/calculations';
import { createNewOther } from '../../utils/itemFactories';
import {
  createTitleEditorColumn,
  createNumberEditorColumn,
  createDeleteButtonColumn,
  createFieldUpdaters,
} from '../../utils/tableConfig';
import { useTotalCost } from '../../hooks/table/useCostTable';
import { reorderItemsWithRanks } from '../../utils/rankUtils';
import { DragEndEvent } from '@dnd-kit/core';

interface OtherTableProps {
  cost: CostEditorStateWithHandlers;
  setCost: Dispatch<SetStateAction<CostEditorStateWithHandlers>>;
  totalCost: number;
  setTotalCost: Dispatch<SetStateAction<number>>;
  setData: Dispatch<SetStateAction<OtherEditorItemWithHandlers[]>>;
  formErrors?: any;
  disabled?: boolean;
}

const createColumns = (
  t: ReturnType<typeof useTranslations>,
  setData: Dispatch<SetStateAction<OtherEditorItemWithHandlers[]>>,
  formErrors?: any,
  disabled?: boolean
) => {
  type OtherWithHandlers = OtherEditorItemWithHandlers &
    ReturnType<typeof createOtherHandlers>;

  const c = createColumnHelper<OtherWithHandlers>();

  // Create field updaters
  // Use OtherEditorItem (without handlers) as the base type to ensure correct type inference
  const updaters = createFieldUpdaters<
    OtherEditorItem,
    OtherEditorItemWithHandlers
  >(setData);
  const setTitle = updaters.createFieldSetter('title');
  const setAmount = updaters.createFieldSetter('amount');
  const removeOther = updaters.createRemover();

  return [
    createTitleEditorColumn({
      c,
      t,
      setTitle,
      formErrors,
      disabled,
    }),
    createNumberEditorColumn({
      c,
      accessor: 'amount',
      headerKey: 'Cost.price',
      setValue: setAmount,
      allowDecimal: true,
      inputMode: 'decimal',
      disabled,
    }),
    createDeleteButtonColumn({
      c,
      removeHandler: removeOther,
      disabled,
    }),
  ];
};

const OtherTable = ({
  cost,
  totalCost,
  setTotalCost,
  setData,
  formErrors,
  disabled,
}: OtherTableProps) => {
  // ============================================================================
  // Basic Hooks
  // ============================================================================
  const t = useTranslations();

  // ============================================================================
  // Custom Hooks
  // ============================================================================
  useTotalCost({
    items: cost.others ?? [],
    calculateTotal: calculateOtherTotal,
    onTotalChange: setTotalCost,
  });

  // ============================================================================
  // Memoized Values
  // ============================================================================
  const columns = useMemo(
    () => createColumns(t, setData, formErrors, disabled),
    [t, setData, formErrors, disabled]
  );

  const othersWithHandlers = useMemo(() => {
    return (cost.others ?? []).map((other) => ({
      ...other,
      ...createOtherHandlers(other.id, setData),
    }));
  }, [cost.others, setData]);

  // ============================================================================
  // Callbacks & Handlers
  // ============================================================================
  const addOtherHandler = () => {
    const newOther = createNewOther(cost.id, setData);
    setData((prev) => [...prev, newOther]);
  };

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
        <h3 className="font-extrabold text-lg">{t('Cost.other')}</h3>
        <p className="text-2xl font-light break-all">${totalCost.toFixed(2)}</p>
      </div>
      <DataTable
        columns={columns}
        data={othersWithHandlers}
        addNewRow={addOtherHandler}
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

export default OtherTable;
