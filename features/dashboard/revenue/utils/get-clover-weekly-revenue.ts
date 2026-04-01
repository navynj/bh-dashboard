import { getCloverMerchantIdForLocation, isCloverConfigured } from '@/lib/clover/config';
import { fetchCloverPaymentsInRange } from '@/lib/clover/fetch-payments';
import { eachDayOfInterval, format } from 'date-fns';
import type { RevenuePeriodData } from '../components/types';
import { weekRangeForMonth } from './week-range';

function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

const EMPTY_SEGMENT_KEY = '_clover_empty';
const EMPTY_SEGMENT_LABEL = 'Clover sales';

function emptyWeekBars(
  weekStart: Date,
  weekEnd: Date,
  weeklyTarget: number,
): RevenuePeriodData {
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  return {
    totalRevenue: 0,
    targetRevenue: weeklyTarget,
    categories: [],
    dailyBars: days.map((day) => ({
      label: format(day, 'EEE').toUpperCase().slice(0, 3),
      segments: { [EMPTY_SEGMENT_KEY]: 0 },
      total: 0,
    })),
    dailyBarSegmentKeys: [EMPTY_SEGMENT_KEY],
    dailyBarSegmentLabels: [EMPTY_SEGMENT_LABEL],
  };
}

/**
 * Weekly Clover sales from the Clover Payments API (not QuickBooks P&L).
 * Budget target still uses the same monthly target as other revenue cards.
 */
export async function getCloverWeeklyRevenueData(
  locationId: string,
  yearMonth: string,
  weekOffset: number,
  monthlyTargetIncome: number,
): Promise<RevenuePeriodData> {
  const dim = daysInMonth(yearMonth);
  const weeklyTarget =
    monthlyTargetIncome > 0 && dim > 0 ? (monthlyTargetIncome * 7) / dim : 0;

  const { weekStart, weekEnd } = weekRangeForMonth(yearMonth, weekOffset);

  if (!isCloverConfigured()) {
    return emptyWeekBars(weekStart, weekEnd, weeklyTarget);
  }

  const merchantId = getCloverMerchantIdForLocation(locationId);
  if (!merchantId) {
    return emptyWeekBars(weekStart, weekEnd, weeklyTarget);
  }

  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();

  let payments: Awaited<ReturnType<typeof fetchCloverPaymentsInRange>>;
  try {
    payments = await fetchCloverPaymentsInRange(merchantId, startMs, endMs);
  } catch {
    return emptyWeekBars(weekStart, weekEnd, weeklyTarget);
  }

  if (payments.length === 0) {
    return emptyWeekBars(weekStart, weekEnd, weeklyTarget);
  }

  const idToLabel = new Map<string, string>();
  for (const p of payments) {
    const tid = p.tender?.id ?? 'unknown';
    const lab = p.tender?.label?.trim() || tid;
    if (!idToLabel.has(tid)) idToLabel.set(tid, lab);
  }

  const segmentKeys = [...idToLabel.keys()].sort((a, b) =>
    (idToLabel.get(a) ?? a).localeCompare(idToLabel.get(b) ?? b),
  );
  const segmentLabels = segmentKeys.map((k) => idToLabel.get(k) ?? k);

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const dayKeys = new Set(days.map((d) => format(d, 'yyyy-MM-dd')));

  const dayTotalsCents = new Map<string, number>();
  const amountByTenderCents = new Map<string, number>();
  const amountByDayAndTender = new Map<string, Map<string, number>>();

  for (const p of payments) {
    const tenderId = p.tender?.id ?? 'unknown';
    const cents = p.amount ?? 0;

    amountByTenderCents.set(
      tenderId,
      (amountByTenderCents.get(tenderId) ?? 0) + cents,
    );

    if (p.createdTime == null) continue;
    const dk = format(new Date(p.createdTime), 'yyyy-MM-dd');
    if (!dayKeys.has(dk)) continue;

    dayTotalsCents.set(dk, (dayTotalsCents.get(dk) ?? 0) + cents);

    let m = amountByDayAndTender.get(dk);
    if (!m) {
      m = new Map();
      amountByDayAndTender.set(dk, m);
    }
    m.set(tenderId, (m.get(tenderId) ?? 0) + cents);
  }

  const weekTotalCents = payments.reduce((s, p) => s + (p.amount ?? 0), 0);

  const categories = segmentKeys.map((id) => ({
    id,
    name: idToLabel.get(id) ?? id,
    amount: (amountByTenderCents.get(id) ?? 0) / 100,
  }));

  const dailyBars = days.map((day) => {
    const key = format(day, 'yyyy-MM-dd');
    const label = format(day, 'EEE').toUpperCase().slice(0, 3);
    const perTender = amountByDayAndTender.get(key) ?? new Map();
    const segments: Record<string, number> = Object.fromEntries(
      segmentKeys.map((id) => [id, (perTender.get(id) ?? 0) / 100]),
    );
    return {
      label,
      segments,
      total: (dayTotalsCents.get(key) ?? 0) / 100,
    };
  });

  return {
    totalRevenue: weekTotalCents / 100,
    targetRevenue: weeklyTarget,
    categories,
    dailyBars,
    dailyBarSegmentKeys: segmentKeys,
    dailyBarSegmentLabels: segmentLabels,
  };
}
