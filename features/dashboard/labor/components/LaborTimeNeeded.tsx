/** Mock weekly hours by weekday (MON–SUN) until scheduling data exists. */
const MOCK_HOURS_BY_DAY = [21, 23, 22, 24, 21, 23, 22] as const;
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export default function LaborTimeNeeded() {
  return (
    <div className="rounded-xl bg-zinc-900 px-3 py-4 text-white shadow-sm">
      <div className="mb-4 flex justify-center">
        <span className="rounded-full bg-white px-4 py-1 text-xs font-semibold text-zinc-900">
          Time Needed
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center sm:gap-2">
        {DAY_LABELS.map((label, i) => (
          <div key={label} className="flex min-w-0 flex-col items-center gap-1">
            <span className="text-[10px] font-medium text-zinc-400 sm:text-xs">
              {label}
            </span>
            <span className="text-lg font-bold tabular-nums">
              {MOCK_HOURS_BY_DAY[i]}
              <span className="text-sm">h</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
