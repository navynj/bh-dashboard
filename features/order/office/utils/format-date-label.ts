import { format, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';

/** `YYYY-MM-DD` or ISO datetime — returns date portion for parsing. */
export function isoDateOnly(iso: string): string {
  const t = iso.trim();
  if (t.length >= 10) return t.slice(0, 10);
  return t;
}

/** Toolbar / period chip, e.g. `Apr 20 (Mon)` */
export function formatOfficeDateChip(iso: string): string {
  try {
    const d = parseISO(isoDateOnly(iso));
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return format(d, 'MMM d (EEE)', { locale: enUS });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Sidebar bucket header (includes year), e.g. `Apr 20, 2026 (Mon)` */
export function formatOfficeDateHeader(iso: string): string {
  try {
    const d = parseISO(isoDateOnly(iso));
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, 'MMM d, yyyy (EEE)', { locale: enUS });
  } catch {
    return iso;
  }
}

/** From a `Date` instance (e.g. Prisma `Date` fields). */
export function formatOfficeDateFromDate(d: Date): string {
  try {
    if (Number.isNaN(d.getTime())) return '';
    return format(d, 'MMM d (EEE)', { locale: enUS });
  } catch {
    return '';
  }
}
