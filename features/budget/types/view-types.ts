/** UI/view types for budget components and pages. Domain types live in types.ts. */

/** Actual COS for the displayed month from QuickBooks (when fetched). */
export type CurrentCosByCategory = {
  categoryId: string;
  name: string;
  amount: number;
}[];

export type BudgetDataType = {
  id: string;
  locationId: string;
  yearMonth: string;
  totalAmount: number;
  budgetRateUsed: number | null;
  referencePeriodMonthsUsed: number | null;
  /** e.g. QB_REFRESH_EXPIRED when budget creation failed; reconnect UI shown on card. */
  error?: string | null;
  location: { id: string; code: string; name: string } | null;
  categories: {
    id: string;
    categoryId: string;
    name: string;
    amount: number;
    percent: number | null;
  }[];
  /** Actual Cost of Sales total for this month from QuickBooks (when available). */
  currentCosTotal?: number;
  /** Actual COS per category for this month from QuickBooks (when available). */
  currentCosByCategory?: CurrentCosByCategory;
  /** Reference-period COS total (N months before yearMonth) for category budget ratio. */
  referenceCosTotal?: number;
  /** Reference-period COS per category (N months before yearMonth). */
  referenceCosByCategory?: { categoryId: string; name: string; amount: number }[];
};

export type BudgetCategoryRow = {
  id: string;
  categoryId: string;
  name: string;
  amount: unknown;
  percent: number | null;
};

export type BudgetWithLocationAndCategories = {
  id: string;
  locationId: string;
  yearMonth: string;
  totalAmount: unknown;
  budgetRateUsed: unknown;
  referencePeriodMonthsUsed: number | null;
  error?: string | null;
  location: { id: string; code: string; name: string } | null;
  categories: BudgetCategoryRow[];
  /** Actual COS total for this month from QuickBooks (when available). */
  currentCosTotal?: number;
  /** Actual COS per category for this month from QuickBooks (when available). */
  currentCosByCategory?: { categoryId: string; name: string; amount: number }[];
  /** Reference-period COS total (N months before yearMonth) for category budget ratio. */
  referenceCosTotal?: number;
  /** Reference-period COS per category (N months before yearMonth). */
  referenceCosByCategory?: { categoryId: string; name: string; amount: number }[];
};

export type BudgetViewProps = {
  yearMonth: string;
  isOfficeOrAdmin: boolean;
  budget: BudgetWithLocationAndCategories | null;
  budgets: BudgetWithLocationAndCategories[];
  locationId: string | null;
  /** Shown when budget create/get failed (e.g. QuickBooks not configured). */
  budgetError?: string | null;
  /** When set (e.g. QB_REFRESH_EXPIRED), show a "Reconnect QuickBooks" button linking to OAuth. */
  reconnectLocationId?: string | null;
  hideChart?: boolean;
};
