'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  type DailySchedule,
  type DriverRow,
  DeliveryDatePicker,
  DeliveryOverviewDriverToolbar,
  DeliveryOverviewMapPanel,
  DeliveryOverviewSchedulePanel,
  DriverNoScheduleCard,
  DriverScheduleCard,
  StopDialog,
} from '@/features/delivery/components';
import { DELETE_STOP_CONFIRM_MESSAGE } from '@/features/delivery/lib/constants';
import {
  useDeliveryDatePicker,
  useDeliveryOverviewTracking,
  useDeliverySchedules,
  useStopDialog,
  useConfirmDialog,
} from '@/features/delivery/hooks';

export default function DeliveryOverviewPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const driverIdFromUrl = searchParams.get('driverId');

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

  const {
    loading,
    fetchData,
    handleReorderStops,
    handleDeleteStop,
    optimisticUpdateScheduleStops,
    handleAddStopWhenNoSchedule,
  } = schedules;

  const drivers = schedules.mode === 'overview' ? schedules.drivers : [];
  const schedulesByDriverId =
    schedules.mode === 'overview' ? schedules.schedulesByDriverId : {};
  const fixedScheduleDriverIdsByDay =
    schedules.mode === 'overview' ? schedules.fixedScheduleDriverIdsByDay : {};

  const selectedDriverId = useMemo((): string | null => {
    if (loading || drivers.length === 0) return null;
    if (
      driverIdFromUrl != null &&
      drivers.some((d) => d.id === driverIdFromUrl)
    ) {
      return driverIdFromUrl;
    }
    return drivers[0].id;
  }, [loading, drivers, driverIdFromUrl]);

  const dayOfWeek = new Date(dateStr + 'T00:00:00.000Z').getUTCDay();
  const driverIdsWithFixedForSelectedDate =
    fixedScheduleDriverIdsByDay[dayOfWeek] ?? new Set<string>();

  const {
    tracking,
    loadingTracking,
    focusDriverLocationRequest,
    requestFreshDriverLocation,
  } = useDeliveryOverviewTracking(selectedDriverId, dateStr);

  const handleDriverChange = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set('driverId', id);
      } else {
        params.delete('driverId');
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

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

  if (schedules.mode !== 'overview') {
    return null;
  }

  const selectedDriver =
    selectedDriverId != null
      ? drivers.find((d) => d.id === selectedDriverId)
      : undefined;
  const scheduleForSelected = selectedDriver
    ? schedulesByDriverId[selectedDriver.id]
    : undefined;
  const selectedDriverHasFixed =
    selectedDriver != null &&
    driverIdsWithFixedForSelectedDate.has(selectedDriver.id);
  const selectedDriverDisplayName = selectedDriver
    ? (selectedDriver.name ?? selectedDriver.email ?? selectedDriver.id)
    : '';

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

      <DeliveryOverviewDriverToolbar
        drivers={drivers}
        loading={loading}
        selectedDriverId={selectedDriverId}
        onDriverChange={handleDriverChange}
        loadingTracking={loadingTracking}
        lastTrackedAt={tracking?.currentLocation?.updatedAt ?? null}
        onTrackCurrentLocation={requestFreshDriverLocation}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <DeliveryOverviewMapPanel
          loadingTracking={loadingTracking}
          tracking={tracking}
          selectedDriverId={selectedDriverId}
          dateStr={dateStr}
          focusDriverLocationRequest={focusDriverLocationRequest}
        />

        <DeliveryOverviewSchedulePanel
          selectedDriver={selectedDriver}
          isToday={isToday}
          selectedDate={selectedDate}
        >
          {loading ? (
            <p className="text-muted-foreground text-sm py-4">Loading…</p>
          ) : drivers.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No drivers. Add drivers from Manage drivers.
            </p>
          ) : !selectedDriverId ? (
            <p className="text-muted-foreground text-sm py-4">
              Select a driver.
            </p>
          ) : !selectedDriver ? (
            <p className="text-muted-foreground text-sm py-4">
              Driver not found.
            </p>
          ) : scheduleForSelected ? (
            <DriverScheduleCard
              key={scheduleForSelected.id}
              schedule={scheduleForSelected}
              dateStr={dateStr}
              onRefresh={fetchData}
              hasFixedScheduleForDate={selectedDriverHasFixed}
              onEditStop={stopDialog.openEdit}
              onAddStop={stopDialog.openAdd}
              onReorderStops={handleReorderStops}
              onDeleteStop={onDeleteStop}
            />
          ) : (
            <DriverNoScheduleCard
              key={selectedDriver.id}
              driver={selectedDriver}
              driverDisplayName={selectedDriverDisplayName}
              dateStr={dateStr}
              onRefresh={fetchData}
              hasFixedScheduleForDate={selectedDriverHasFixed}
              onAddStop={onAddStopWhenNoSchedule}
              contentOnly
            />
          )}
        </DeliveryOverviewSchedulePanel>
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
