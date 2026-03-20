'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { format } from 'date-fns';
import {
  type DailySchedule,
  type DriverRow,
  DeliveryDatePicker,
  DriverNoScheduleCard,
  DriverScheduleCard,
  MapPlaceholder,
  mapPlaceholderTitle,
  StopDialog,
} from '@/features/delivery/components';
import { DELETE_STOP_CONFIRM_MESSAGE } from '@/features/delivery/lib/constants';
import {
  useDeliveryDatePicker,
  useDeliverySchedules,
  useStopDialog,
  useConfirmDialog,
} from '@/features/delivery/hooks';

export default function DeliveryOverviewPage() {
  const {
    dateStr,
    setDateStr,
    selectedDate,
    isToday,
    goPrevWeek,
    goNextWeek,
    weekDays,
    isSameDay,
  } = useDeliveryDatePicker();
  const stopDialog = useStopDialog();
  const confirmDialog = useConfirmDialog();
  const schedules = useDeliverySchedules(dateStr);

  if (schedules.mode !== 'overview') {
    return null;
  }

  const {
    loading,
    drivers,
    schedulesByDriverId,
    fixedScheduleDriverIdsByDay,
    fetchData,
    handleReorderStops,
    handleDeleteStop,
    optimisticUpdateScheduleStops,
    handleAddStopWhenNoSchedule,
  } = schedules;

  const dayOfWeek = new Date(dateStr + 'T00:00:00.000Z').getUTCDay();
  const driverIdsWithFixedForSelectedDate =
    fixedScheduleDriverIdsByDay[dayOfWeek] ?? new Set<string>();

  const onAddStopWhenNoSchedule = useCallback(
    async (driver: DriverRow) => {
      const created: DailySchedule | null =
        await handleAddStopWhenNoSchedule(driver);
      if (created != null) {
        stopDialog.setSchedule(created);
        stopDialog.setStopIndex(-1);
        stopDialog.setInsertIndex(0);
        stopDialog.setOpen(true);
      }
    },
    [handleAddStopWhenNoSchedule, stopDialog],
  );

  const onDeleteStop = useCallback(
    (schedule: DailySchedule, stopIndex: number) => {
      const stopName = schedule.stops?.[stopIndex]?.name ?? 'this stop';
      confirmDialog.openConfirm({
        title: 'Delete stop',
        description: DELETE_STOP_CONFIRM_MESSAGE(stopName),
        variant: 'destructive',
        confirmLabel: 'Delete',
        onConfirm: () => handleDeleteStop(schedule, stopIndex),
      });
    },
    [confirmDialog, handleDeleteStop],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/delivery/drivers">Manage drivers</Link>
        </Button>
      </div>

      <DeliveryDatePicker
        dateStr={dateStr}
        setDateStr={setDateStr}
        selectedDate={selectedDate}
        isToday={isToday}
        goPrevWeek={goPrevWeek}
        goNextWeek={goNextWeek}
        weekDays={weekDays}
        isSameDay={isSameDay}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MapPlaceholder
          titleLabel={mapPlaceholderTitle(isToday, selectedDate)}
          subtitle="(To be developed — 지도에 오늘 배송 기사 이동경로 및 현재 위치 표시)"
        />

        <div className="border rounded-lg flex flex-col min-h-[400px]">
          <div className="p-4 border-b">
            <h2 className="font-medium">Drivers&apos; current status</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {isToday ? "Today's" : format(selectedDate, 'MMM d')} schedules.
              Unfold to see all stops and tasks.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <p className="text-muted-foreground text-sm py-4">Loading…</p>
            ) : drivers.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No drivers. Add drivers from Manage drivers.
              </p>
            ) : (
              drivers.map((driver) => {
                const schedule = schedulesByDriverId[driver.id];
                const hasFixedForDate = driverIdsWithFixedForSelectedDate.has(
                  driver.id,
                );
                const driverDisplayName =
                  driver.name ?? driver.email ?? driver.id;
                if (schedule) {
                  return (
                    <DriverScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      driverDisplayName={driverDisplayName}
                      dateStr={dateStr}
                      onRefresh={fetchData}
                      hasFixedScheduleForDate={hasFixedForDate}
                      onEditStop={stopDialog.openEdit}
                      onAddStop={stopDialog.openAdd}
                      onReorderStops={handleReorderStops}
                      onDeleteStop={onDeleteStop}
                    />
                  );
                }
                return (
                  <DriverNoScheduleCard
                    key={driver.id}
                    driver={driver}
                    driverDisplayName={driverDisplayName}
                    dateStr={dateStr}
                    onRefresh={fetchData}
                    hasFixedScheduleForDate={hasFixedForDate}
                    onAddStop={onAddStopWhenNoSchedule}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {stopDialog.schedule && (
        <StopDialog
          open={stopDialog.open}
          schedule={stopDialog.schedule}
          stopIndex={stopDialog.stopIndex}
          insertIndex={stopDialog.insertIndex}
          onClose={stopDialog.close}
          onSaved={() => {
            stopDialog.close();
            fetchData();
          }}
          onOptimisticUpdate={optimisticUpdateScheduleStops}
          onRevert={fetchData}
        />
      )}

      <ConfirmDialog {...confirmDialog.dialogProps} />
    </div>
  );
}
