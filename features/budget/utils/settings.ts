import { prisma } from '@/lib/core/prisma';

const DEFAULT_BUDGET_RATE = 0.3;
export const DEFAULT_REFERENCE_PERIOD_MONTHS = 6;

/** Get or create the single BudgetSettings row (default rate 33%, reference 6 months). */
export async function getOrCreateBudgetSettings() {
  let settings = await prisma.budgetSettings.findFirst();
  if (!settings) {
    settings = await prisma.budgetSettings.create({
      data: {
        budgetRate: DEFAULT_BUDGET_RATE,
        referencePeriodMonths: DEFAULT_REFERENCE_PERIOD_MONTHS,
      },
    });
  }
  return settings;
}
