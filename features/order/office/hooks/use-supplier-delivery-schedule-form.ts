'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  cloneBhSplitTemplateWindows,
  parseSupplierDeliverySchedule,
  supplierDeliveryScheduleFromPartitionWindows,
  type IsoWeekWindow,
  type SupplierDeliverySchedule,
} from '@/lib/order/supplier-delivery-schedule';

export const ISO_WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

export type DeliveryRuleKind =
  | 'off'
  | 'next'
  | 'day_after_creation'
  | 'partition';

export function ruleKindFromSchedule(
  raw: unknown | null | undefined,
): DeliveryRuleKind {
  if (raw == null) return 'off';
  const s = parseSupplierDeliverySchedule(raw);
  if (!s) return 'off';
  if (s.rule.kind === 'day_after_creation') return 'day_after_creation';
  if (s.rule.kind === 'next_delivery_day') return 'next';
  if (s.rule.kind === 'iso_week_windows') return 'partition';
  return 'off';
}

export function initialPartitionWindows(
  raw: unknown | null | undefined,
): IsoWeekWindow[] {
  const s = parseSupplierDeliverySchedule(raw);
  if (!s || s.rule.kind !== 'iso_week_windows') return [];
  return s.rule.windows.map((w) => ({
    orderWeekdays: [...w.orderWeekdays],
    deliverWeekday: w.deliverWeekday,
    deliverIn: w.deliverIn,
  }));
}

export function validatePartitionWindows(
  windows: IsoWeekWindow[],
): string | null {
  if (windows.length === 0) {
    return 'Add at least one partition window, or turn off the delivery schedule.';
  }
  for (let i = 0; i < windows.length; i++) {
    if (windows[i].orderWeekdays.length === 0) {
      return `Window ${i + 1}: pick at least one “order placed on” weekday.`;
    }
  }
  const seen = new Set<number>();
  for (const w of windows) {
    for (const d of w.orderWeekdays) {
      if (seen.has(d)) {
        return `Order weekday ${d} appears in more than one window.`;
      }
      seen.add(d);
    }
  }
  return null;
}

export function weekdaysFromSchedule(
  raw: unknown | null | undefined,
): number[] {
  const s = parseSupplierDeliverySchedule(raw);
  if (!s) return [];
  return [...new Set(s.deliveryWeekdays)].sort((a, b) => a - b);
}

export function useSupplierDeliveryScheduleForm(
  initialScheduleRaw: unknown | null | undefined,
) {
  const [deliveryRuleKind, setDeliveryRuleKind] = useState<DeliveryRuleKind>(
    () => ruleKindFromSchedule(initialScheduleRaw),
  );
  const [deliveryWeekdays, setDeliveryWeekdays] = useState<number[]>(() =>
    weekdaysFromSchedule(initialScheduleRaw),
  );
  const [partitionWindows, setPartitionWindows] = useState<IsoWeekWindow[]>(
    () => initialPartitionWindows(initialScheduleRaw),
  );

  useEffect(() => {
    setDeliveryRuleKind(ruleKindFromSchedule(initialScheduleRaw));
    setDeliveryWeekdays(weekdaysFromSchedule(initialScheduleRaw));
    setPartitionWindows(initialPartitionWindows(initialScheduleRaw));
  }, [initialScheduleRaw]);

  const buildDeliverySchedulePayload =
    useCallback((): SupplierDeliverySchedule | null => {
      if (deliveryRuleKind === 'off') return null;
      if (deliveryRuleKind === 'partition') {
        return supplierDeliveryScheduleFromPartitionWindows(partitionWindows);
      }
      if (deliveryRuleKind === 'day_after_creation') {
        return {
          deliveryWeekdays: [],
          rule: { kind: 'day_after_creation' },
        };
      }
      if (deliveryWeekdays.length === 0) return null;
      return {
        deliveryWeekdays: [...new Set(deliveryWeekdays)].sort((a, b) => a - b),
        rule: { kind: 'next_delivery_day' },
      };
    }, [deliveryRuleKind, deliveryWeekdays, partitionWindows]);

  const validateScheduleForSubmit = useCallback((): string | null => {
    if (deliveryRuleKind === 'partition') {
      return validatePartitionWindows(partitionWindows);
    }
    if (deliveryRuleKind === 'next' && deliveryWeekdays.length === 0) {
      return 'Pick at least one delivery weekday, or turn off the delivery schedule.';
    }
    return null;
  }, [deliveryRuleKind, deliveryWeekdays.length, partitionWindows]);

  const selectOff = useCallback(() => {
    setDeliveryRuleKind('off');
    setDeliveryWeekdays([]);
    setPartitionWindows([]);
  }, []);

  const selectNext = useCallback(() => {
    setDeliveryRuleKind('next');
  }, []);

  const selectDayAfterCreation = useCallback(() => {
    setDeliveryRuleKind('day_after_creation');
    setPartitionWindows([]);
  }, []);

  const selectPartition = useCallback(() => {
    setDeliveryRuleKind('partition');
    setPartitionWindows((prev) =>
      prev.length > 0 ? prev : cloneBhSplitTemplateWindows(),
    );
  }, []);

  const patchPartitionWindow = useCallback(
    (index: number, patch: Partial<IsoWeekWindow>) => {
      setPartitionWindows((prev) =>
        prev.map((w, i) => (i === index ? { ...w, ...patch } : w)),
      );
    },
    [],
  );

  const togglePartitionOrderDay = useCallback(
    (windowIndex: number, d: number) => {
      setPartitionWindows((prev) =>
        prev.map((w, i) => {
          if (i !== windowIndex) return w;
          const has = w.orderWeekdays.includes(d);
          if (has) {
            return {
              ...w,
              orderWeekdays: w.orderWeekdays.filter((x) => x !== d),
            };
          }
          const takenElsewhere = prev.some(
            (other, j) => j !== windowIndex && other.orderWeekdays.includes(d),
          );
          if (takenElsewhere) return w;
          return {
            ...w,
            orderWeekdays: [...w.orderWeekdays, d].sort((a, b) => a - b),
          };
        }),
      );
    },
    [],
  );

  const addPartitionWindow = useCallback(() => {
    setPartitionWindows((prev) => [
      ...prev,
      {
        orderWeekdays: [1],
        deliverWeekday: 5,
        deliverIn: 'same_iso_week' as const,
      },
    ]);
  }, []);

  const removePartitionWindow = useCallback((index: number) => {
    setPartitionWindows((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }, []);

  const applyBhSplitTemplate = useCallback(() => {
    setPartitionWindows(cloneBhSplitTemplateWindows());
  }, []);

  const toggleDeliveryWeekday = useCallback((d: number) => {
    setDeliveryWeekdays((prev) =>
      prev.includes(d)
        ? prev.filter((x) => x !== d)
        : [...prev, d].sort((a, b) => a - b),
    );
  }, []);

  return {
    deliveryRuleKind,
    deliveryWeekdays,
    partitionWindows,
    selectOff,
    selectNext,
    selectDayAfterCreation,
    selectPartition,
    toggleDeliveryWeekday,
    patchPartitionWindow,
    togglePartitionOrderDay,
    addPartitionWindow,
    removePartitionWindow,
    applyBhSplitTemplate,
    buildDeliverySchedulePayload,
    validateScheduleForSubmit,
  };
}

export type SupplierDeliveryScheduleForm = ReturnType<
  typeof useSupplierDeliveryScheduleForm
>;
