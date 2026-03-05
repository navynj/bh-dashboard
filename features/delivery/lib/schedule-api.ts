import type {
  DailySchedule,
  DriverRow,
  Stop,
} from '@/features/delivery/types/delivery-schedule-types';

/** Shape of a stop in PATCH /api/delivery/daily-schedule/[id] body */
export type StopPayload = {
  id: string;
  deliveryLocationId: string | null;
  name: string;
  address?: string;
  tasks: { id: string; title: string }[];
};

export function stopsToPayload(stops: Stop[]): StopPayload[] {
  return stops.map((s) => ({
    id: s.id,
    deliveryLocationId: s.deliveryLocationId ?? null,
    name: s.name,
    address: s.address ?? undefined,
    tasks: (s.tasks ?? []).map((t) => ({ id: t.id, title: t.title })),
  }));
}

type ApiCreatedStop = {
  id: string;
  sequence: number;
  name: string;
  address?: string | null;
  tasks?: { id: string; sequence: number; title: string }[];
};

type ApiCreatedSchedule = {
  id: string;
  date: string;
  driverId: string;
  driver?: { id: string; name: string | null };
  stops: ApiCreatedStop[];
};

export function normalizeCreatedSchedule(
  created: ApiCreatedSchedule,
  driver: DriverRow,
): DailySchedule {
  return {
    id: created.id,
    date: created.date,
    driverId: created.driverId,
    driver: {
      id: created.driver?.id ?? driver.id,
      name: created.driver?.name ?? driver.name ?? driver.email,
    },
    stops: (created.stops ?? []).map((s) => ({
      id: s.id,
      sequence: s.sequence,
      name: s.name,
      address: s.address ?? null,
      deliveryLocationId: null,
      arrivedAt: null,
      departedAt: null,
      tasks: (s.tasks ?? []).map((t) => ({
        id: t.id,
        sequence: t.sequence,
        title: t.title,
        completedAt: null,
      })),
    })),
  };
}
