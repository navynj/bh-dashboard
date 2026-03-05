'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
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

export default function DriverDetailPage() {
  const params = useParams();
  const driverId = params.driverId as string;
  const { dateStr, setDateStr, selectedDate, isToday, goPrevDay, goNextDay, weekDays, isSameDay } =
    useDeliveryDatePicker();
  const stopDialog = useStopDialog();
  const confirmDialog = useConfirmDialog();
  const schedules = useDeliverySchedules(dateStr, { driverId });

  if (schedules.mode !== 'driver') {
    return null;
  }

  const {
    loading,
    driver,
    schedule,
    hasFixedScheduleForDate,
    fetchData,
    handleReorderStops,
    handleDeleteStop,
    optimisticUpdateScheduleStops,
    handleAddStopWhenNoSchedule,
  } = schedules;

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

  if (loading) {
    return <div className="py-8 text-muted-foreground">Loading driver…</div>;
  }

  if (!driver) {
    return (
      <div className="py-8">
        <p className="text-destructive">Driver not found.</p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/delivery/drivers">Back to Drivers</Link>
        </Button>
      </div>
    );
  }

  const driverDisplayName = driver.name ?? driver.email ?? driver.id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Link href="/delivery" className="hover:underline">
            Overview
          </Link>
          <span>/</span>
          <Link href="/delivery/drivers" className="hover:underline">
            Drivers
          </Link>
          <span>/</span>
          <span className="text-foreground">{driverDisplayName}</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/delivery/drivers/${driverId}/fixed-schedule`}>
            Edit fixed schedule
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-semibold">{driverDisplayName}</h1>

      <DeliveryDatePicker
        dateStr={dateStr}
        setDateStr={setDateStr}
        selectedDate={selectedDate}
        isToday={isToday}
        goPrevDay={goPrevDay}
        goNextDay={goNextDay}
        weekDays={weekDays}
        isSameDay={isSameDay}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MapPlaceholder
          titleLabel={mapPlaceholderTitle(isToday, selectedDate)}
          subtitle="(To be developed — 지도에 배송 기사 이동경로 및 현재 위치 표시)"
          placeholderText="Map view placeholder"
        />

        <div className="border rounded-lg flex flex-col min-h-[400px]">
          <div className="p-4 border-b">
            <h2 className="font-medium">Schedule</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {isToday ? "Today's" : format(selectedDate, 'MMM d')} stops and
              tasks. Add, edit, reorder, or delete stops.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {schedule ? (
              <DriverScheduleCard
                key={schedule.id}
                schedule={schedule}
                driverDisplayName={driverDisplayName}
                dateStr={dateStr}
                onRefresh={fetchData}
                hasFixedScheduleForDate={hasFixedScheduleForDate}
                onEditStop={stopDialog.openEdit}
                onAddStop={stopDialog.openAdd}
                onReorderStops={handleReorderStops}
                onDeleteStop={onDeleteStop}
                contentOnly
              />
            ) : (
              <DriverNoScheduleCard
                key={driver.id}
                driver={driver}
                driverDisplayName={driverDisplayName}
                dateStr={dateStr}
                onRefresh={fetchData}
                hasFixedScheduleForDate={hasFixedScheduleForDate}
                onAddStop={onAddStopWhenNoSchedule}
                contentOnly
              />
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
