/** Compute total budget from reference income and rate. */
export function computeTotalBudget(
  incomeTotal: number,
  rate: number,
  referenceMonths: number,
): number {
  if (referenceMonths <= 0) return 0;
  const averageMonthlyIncome = incomeTotal / referenceMonths;
  return Math.round(averageMonthlyIncome * rate);
}

/** Distribute total budget to categories by COS percentage. */
export function distributeByCosPercent(
  totalBudget: number,
  cosByCategory: { categoryId: string; name: string; amount: number }[],
): {
  categoryId: string;
  name: string;
  amount: number;
  percent: number | null;
}[] {
  const totalCos = cosByCategory.reduce((s, c) => s + c.amount, 0);
  if (totalCos <= 0) {
    return cosByCategory.map((c) => ({ ...c, amount: 0, percent: null }));
  }
  return cosByCategory.map((c) => {
    const percent = (c.amount / totalCos) * 100;
    const amount = Math.round(totalBudget * (c.amount / totalCos) * 100) / 100;
    return { categoryId: c.categoryId, name: c.name, amount, percent };
  });
}
