/** Shopify / office “ordered at” display & bucketing (America/Vancouver). */
export const OFFICE_ORDERED_TIME_ZONE = 'America/Vancouver';

const chipFmt: Intl.DateTimeFormatOptions = {
  timeZone: OFFICE_ORDERED_TIME_ZONE,
  month: 'short',
  day: 'numeric',
};

const chipWdFmt: Intl.DateTimeFormatOptions = {
  timeZone: OFFICE_ORDERED_TIME_ZONE,
  weekday: 'short',
};

const orderedDetailFmt: Intl.DateTimeFormatOptions = {
  timeZone: OFFICE_ORDERED_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

/** Calendar `YYYY-MM-DD` in Vancouver for an instant (for chips / filters). */
export function toVancouverYmd(d: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: OFFICE_ORDERED_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function toVancouverYmdFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return toVancouverYmd(d);
}

/** Full ordered timestamp for PO panel / drafts (ISO string). */
export function toOrderedAtIso(d: Date): string {
  return d.toISOString();
}

/** `Apr 20, 2026, 3:45 PM` style in Vancouver. */
export function formatVancouverOrderedDetail(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', orderedDetailFmt).format(d);
}

const sidebarOrderedFmt: Intl.DateTimeFormatOptions = {
  timeZone: OFFICE_ORDERED_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

/** Compact line (e.g. sidebar): `Apr 20, 3:45 PM` in Vancouver. */
export function formatVancouverOrderedSidebar(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', sidebarOrderedFmt).format(d);
}

/**
 * `Apr 20 (Mon)` for a `YYYY-MM-DD` that already means a Vancouver calendar day
 * (e.g. `latestOrderedAt`). Uses UTC noon on that civil date so the weekday matches
 * the Gregorian calendar everywhere.
 */
export function formatVancouverYmdChip(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const utcNoon = new Date(Date.UTC(y, mo - 1, day, 12, 0, 0));
  const md = new Intl.DateTimeFormat('en-US', { ...chipFmt, timeZone: 'UTC' }).format(
    utcNoon,
  );
  const wd = new Intl.DateTimeFormat('en-US', { ...chipWdFmt, timeZone: 'UTC' }).format(
    utcNoon,
  );
  return `${md} (${wd})`;
}
