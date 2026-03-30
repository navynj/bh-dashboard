export type RevenueCategoryItem = {
  id: string;
  name: string;
  amount: number;
  /** Share of total revenue (0–1); optional if derived from amounts. */
  percent?: number;
};

export type RevenueDailyBarRow = {
  /** Short label e.g. SUN */
  label: string;
  /** Amount per top-level Income line (`dailyBarSegmentKeys` on period data). */
  segments: Record<string, number>;
  /** Sum of segment amounts for footer display */
  total: number;
};

export type RevenuePeriodData = {
  totalRevenue: number;
  targetRevenue: number;
  categories: RevenueCategoryItem[];
  /** Weekly only: ordered keys for `dailyBars[].segments` (top-level P&L Income account ids). */
  dailyBarSegmentKeys?: string[];
  /** Same order as `dailyBarSegmentKeys`; Income account labels for legend/tooltip. */
  dailyBarSegmentLabels?: string[];
  /** Weekly only: stacked bars per day */
  dailyBars?: RevenueDailyBarRow[];
};
