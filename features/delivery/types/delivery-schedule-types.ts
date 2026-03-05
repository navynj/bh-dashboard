export type Task = {
  id: string;
  sequence: number;
  title: string;
  completedAt: string | null;
};

export type Stop = {
  id: string;
  sequence: number;
  name: string;
  address: string | null;
  deliveryLocationId?: string | null;
  arrivedAt: string | null;
  departedAt: string | null;
  tasks: Task[];
};

export type DailySchedule = {
  id: string;
  date: string;
  driverId: string;
  driver: { id: string; name: string | null };
  stops: Stop[];
};

export type DriverRow = {
  id: string;
  name: string | null;
  email: string | null;
};
