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
};

export type BudgetViewProps = {
  yearMonth: string;
  isOfficeOrAdmin: boolean;
  budget: BudgetWithLocationAndCategories | null;
  budgets: BudgetWithLocationAndCategories[];
  locationId: string | null;
  /** Shown when budget create/get failed (e.g. QuickBooks not configured). */
  budgetError?: string | null;
}
