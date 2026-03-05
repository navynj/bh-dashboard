export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const DELETE_STOP_CONFIRM_MESSAGE = (stopName: string) =>
  `Delete stop "${stopName}"? This will remove the stop and its tasks from this schedule.`;
