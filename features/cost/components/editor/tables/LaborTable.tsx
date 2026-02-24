'use client';

import { Dispatch, SetStateAction, useCallback, useMemo } from 'react';
import {
  CostEditorStateWithHandlers,
  LaborEditorItemWithHandlers,
  LaborEditorItem,
} from '@/features/cost/types/cost';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { useTranslations } from 'next-intl';
import { createLaborHandlers } from '../../utils/handlers/handlers';
import { calculateLaborTotal } from '../../utils/calculations/calculations';
import { createNewLabor } from '../../utils/itemFactories';
import {
  createTitleEditorColumn,
  createNumberEditorColumn,
  createDeleteButtonColumn,
  createFieldUpdaters,
} from '../../utils/tableConfig';
import { useTotalCost } from '../../hooks/table/useCostTable';
import { reorderItemsWithRanks } from '../../utils/rankUtils';
import { DragEndEvent } from '@dnd-kit/core';

interface LaborTableProps {
  cost: CostEditorStateWithHandlers;
  setCost: Dispatch<SetStateAction<CostEditorStateWithHandlers>>;
  totalCost: number;
  setTotalCost: Dispatch<SetStateAction<number>>;
  setData: Dispatch<SetStateAction<LaborEditorItemWithHandlers[]>>;
  formErrors?: any;
  disabled?: boolean;
}

const createColumns = (
  t: ReturnType<typeof useTranslations>,
  setData: Dispatch<SetStateAction<LaborEditorItemWithHandlers[]>>,
  formErrors?: any,
  disabled?: boolean
) => {
  type LaborWithHandlers = LaborEditorItemWithHandlers &
    ReturnType<typeof createLaborHandlers>;

  const c = createColumnHelper<LaborWithHandlers>();

  const updaters = createFieldUpdaters<
    LaborEditorItem,
    LaborEditorItemWithHandlers
  >(setData);

  return [
    createTitleEditorColumn({
      c,
      t,
      setTitle: updaters.createFieldSetter('title'),
      formErrors,
      disabled,
    }),
    createNumberEditorColumn({
      c,
      accessor: 'wage',
      headerKey: 'Cost.wage',
      setValue: updaters.createFieldSetter('wage'),
      allowDecimal: true,
      inputMode: 'decimal',
      disabled,
    }),
    createNumberEditorColumn({
      c,
      accessor: 'time',
      headerKey: 'Cost.timeHours',
      setValue: updaters.createFieldSetter('time'),
      allowDecimal: true,
      inputMode: 'decimal',
      disabled,
    }),
    createNumberEditorColumn({
      c,
      accessor: 'people',
      headerKey: 'Cost.people',
      setValue: updaters.createFieldSetter('people'),
      disabled,
    }),
    createDeleteButtonColumn({
      c,
      removeHandler: updaters.createRemover(),
      disabled,
    }),
  ];
};

const LaborTable = ({
  cost,
  totalCost,
  setTotalCost,
  setData,
  formErrors,
  disabled,
}: LaborTableProps) => {
  // ============================================================================
  // Basic Hooks
  // ============================================================================
  const t = useTranslations();

  // ============================================================================
  // Custom Hooks
  // ============================================================================
  useTotalCost({
    items: cost.labors ?? [],
    calculateTotal: calculateLaborTotal,
    onTotalChange: setTotalCost,
  });

  // ============================================================================
  // Memoized Values
  // ============================================================================
  const columns = useMemo(
    () => createColumns(t, setData, formErrors, disabled),
    [t, setData, formErrors, disabled]
  );

  const laborsWithHandlers = useMemo(() => {
    return (cost.labors ?? []).map((labor) => ({
      ...labor,
      ...createLaborHandlers(labor.id, setData),
    }));
  }, [cost.labors, setData]);

  // ============================================================================
  // Callbacks & Handlers
  // ============================================================================
  const addLaborHandler = () => {
    const newLabor = createNewLabor(cost.id, setData);
    setData((prev) => [...prev, newLabor]);
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
        <h3 className="font-extrabold text-lg">{t('Cost.labor')}</h3>
        <p className="text-2xl font-light break-all">${totalCost.toFixed(2)}</p>
      </div>
      <DataTable
        columns={columns}
        data={laborsWithHandlers}
        addNewRow={addLaborHandler}
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

export default LaborTable;
