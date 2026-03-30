/** Request context for fetching P&L via GET /api/quickbooks/pnl (so only routes send to QuickBooks). */
export type QuickBooksApiContext = {
  baseUrl: string;
  cookie: string | null;
};

/** Reference income total and COS per category for budget calculation. */
export type ReferenceData = {
  incomeTotal?: number;
  cosTotal?: number;
  cosByCategory?: { categoryId: string; name: string; amount: number }[];
};

export type CreateBudgetInput = {
  locationId: string;
  yearMonth: string;
  userId: string;
  budgetRate?: number;
  referencePeriodMonths?: number;
  /** If provided, use this instead of fetching from QB. */
  referenceData?: ReferenceData;
  /** Required when referenceData is not provided (so we can call /api/quickbooks for COS). */
  context?: QuickBooksApiContext;
};
