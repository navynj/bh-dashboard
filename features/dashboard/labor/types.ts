export type LaborCategoryItem = {
  id: string;
  name: string;
  amount: number;
  percent?: number;
};

export type LaborDashboardData = {
  totalLabor: number;
  /** Target = rate × (reference income ÷ ref months); same rate/ref as Cost budget. */
  targetLabor: number;
  displayRate: number;
  displayPeriod: number;
  referenceIncomeTotal: number | null;
  categories: LaborCategoryItem[];
};
