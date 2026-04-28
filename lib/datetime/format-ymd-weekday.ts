import { format, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';

/** `YYYY-MM-DD` — e.g. `Apr 27, 2026 (Mon)`. */
export function formatYmdWithWeekday(ymd: string): string {
  const t = ymd.trim();
  if (t.length < 10) return '';
  const d = parseISO(t.slice(0, 10));
  if (Number.isNaN(d.getTime())) return t.slice(0, 10);
  return format(d, 'MMM d, yyyy (EEE)', { locale: enUS });
}
