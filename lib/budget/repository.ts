import { AppError } from '@/lib/core/errors';
import { prisma } from '@/lib/core/prisma';
import type { Prisma } from '@prisma/client';
import type { BudgetDataType } from './view-types';
import { parseYearMonth, isValidYearMonth, isBeforeYearMonth } from '@/lib/utils';
import type { CreateBudgetInput, QuickBooksApiContext } from './types';
import { computeTotalBudget } from './calculations';
import { getOrCreateBudgetSettings, DEFAULT_REFERENCE_PERIOD_MONTHS } from './settings';
import { getReferenceIncomeAndCos, getCurrentMonthCos } from './reference-data';

type BudgetWithLocationRaw = Prisma.BudgetGetPayload<{
  include: { location: true };
}>;

/** Create or update a budget row with error set (e.g. QB_REFRESH_EXPIRED). */
async function upsertBudgetStubWithError(
  locationId: string,
  yearMonth: string,
  errorCode: string,
): Promise<BudgetWithLocationRaw> {
  const existing = await prisma.budget.findUnique({
    where: { locationId_yearMonth: { locationId, yearMonth } },
    include: { location: true },
  });
  if (existing) {
    await prisma.budget.update({
      where: { id: existing.id },
      data: {
        totalAmount: 0,
        budgetRateUsed: null,
        referencePeriodMonthsUsed: null,
        error: errorCode,
      },
    });
    return prisma.budget.findUniqueOrThrow({
      where: { id: existing.id },
      include: { location: true },
    });
  }
  return prisma.budget.create({
    data: {
      location: { connect: { id: locationId } },
      yearMonth,
      totalAmount: 0,
      budgetRateUsed: null,
      referencePeriodMonthsUsed: null,
      error: errorCode,
    },
    include: { location: true },
  });
}

type RawBudgetWithInclude = Awaited<
  ReturnType<
    typeof prisma.budget.findFirst<{ include: { location: true } }>
  >
> extends infer R
  ? R extends null
    ? never
    : R
  : never;

export function mapBudgetToDataType(raw: RawBudgetWithInclude): BudgetDataType {
  return {
    id: raw.id,
    locationId: raw.locationId,
    yearMonth: raw.yearMonth,
    totalAmount: Number(raw.totalAmount),
    budgetRateUsed:
      raw.budgetRateUsed != null ? Number(raw.budgetRateUsed) : null,
    referencePeriodMonthsUsed: raw.referencePeriodMonthsUsed,
    error: raw.error ?? null,
    location: raw.location,
    categories: [],
  };
}

export async function ensureBudgetForMonth(
  input: CreateBudgetInput,
): Promise<BudgetWithLocationRaw | null> {
  const { locationId, yearMonth, userId, referenceData: providedRef } = input;
  if (!isValidYearMonth(yearMonth)) {
    throw new AppError('Invalid yearMonth; use YYYY-MM');
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { startYearMonth: true },
  });
  if (location?.startYearMonth != null && isBeforeYearMonth(yearMonth, location.startYearMonth)) {
    return null;
  }

  try {
    const existing = await prisma.budget.findUnique({
      where: { locationId_yearMonth: { locationId, yearMonth } },
      include: { location: true },
    });

    const settings = await getOrCreateBudgetSettings();
    const rate = input.budgetRate ?? Number(settings.budgetRate);
    const refMonths =
      input.referencePeriodMonths ?? settings.referencePeriodMonths;

    const context = input.context;
    const skipRefFetch = refMonths <= 0;
    const ref =
      providedRef ??
      (skipRefFetch
        ? { incomeTotal: 0, cosTotal: undefined, cosByCategory: undefined }
        : context
          ? await getReferenceIncomeAndCos(
              userId,
              locationId,
              yearMonth,
              refMonths,
              context,
            )
          : (() => {
              throw new AppError(
                'context (baseUrl, cookie) required to fetch reference COS via /api/quickbooks',
              );
            })());

    const refIncome = ref.incomeTotal ?? 0;
    const noReference = skipRefFetch || refIncome <= 0;
    const effectiveRefMonths = noReference ? 0 : refMonths;
    const totalAmount = noReference
      ? 0
      : computeTotalBudget(refIncome, rate, refMonths);

    if (existing) {
      await prisma.budget.update({
        where: { id: existing.id },
        data: {
          totalAmount,
          budgetRateUsed: rate,
          referencePeriodMonthsUsed: effectiveRefMonths,
          error: null,
        },
      });
      return prisma.budget.findUniqueOrThrow({
        where: { id: existing.id },
        include: { location: true },
      });
    }

    return prisma.budget.create({
      data: {
        location: { connect: { id: locationId } },
        yearMonth,
        totalAmount,
        budgetRateUsed: rate,
        referencePeriodMonthsUsed: effectiveRefMonths,
      },
      include: { location: true },
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'QB_REFRESH_EXPIRED') {
      return upsertBudgetStubWithError(
        locationId,
        yearMonth,
        'QB_REFRESH_EXPIRED',
      );
    }
    throw e;
  }
}

export async function getBudgetByLocationAndMonth(
  locationId: string,
  yearMonth: string,
): Promise<BudgetDataType | null> {
  const raw = await prisma.budget.findUnique({
    where: { locationId_yearMonth: { locationId, yearMonth } },
    include: { location: true },
  });
  return raw ? mapBudgetToDataType(raw) : null;
}

export async function attachCurrentMonthCosToBudgets<
  T extends { locationId: string },
>(
  budgets: T[],
  yearMonth: string,
  context: QuickBooksApiContext,
): Promise<
  (T & {
    currentCosTotal?: number;
    currentCosByCategory?: {
      categoryId: string;
      name: string;
      amount: number;
    }[];
  })[]
> {
  if (!isValidYearMonth(yearMonth))
    return budgets as (T & {
      currentCosTotal?: number;
      currentCosByCategory?: {
        categoryId: string;
        name: string;
        amount: number;
      }[];
    })[];
  const { year, month } = parseYearMonth(yearMonth);
  const results = await Promise.allSettled(
    budgets.map(async (b) =>
      getCurrentMonthCos(b.locationId, { year, month }, 1, context),
    ),
  );
  return budgets.map((b, i) => {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value.cosByCategory) {
      return {
        ...b,
        currentCosTotal:
          r.value.cosTotal ??
          r.value.cosByCategory.reduce((s, c) => s + c.amount, 0),
        currentCosByCategory: r.value.cosByCategory,
      };
    }
    return b;
  });
}

export async function attachReferenceCosToBudgets<
  T extends { locationId: string; referencePeriodMonthsUsed?: number | null },
>(
  budgets: T[],
  yearMonth: string,
  userId: string,
  context: QuickBooksApiContext,
): Promise<
  (T & {
    referenceCosTotal?: number;
    referenceCosByCategory?: {
      categoryId: string;
      name: string;
      amount: number;
    }[];
  })[]
> {
  if (!isValidYearMonth(yearMonth))
    return budgets as (T & {
      referenceCosTotal?: number;
      referenceCosByCategory?: {
        categoryId: string;
        name: string;
        amount: number;
      }[];
    })[];
  const results = await Promise.allSettled(
    budgets.map(async (b) => {
      const refMonths =
        b.referencePeriodMonthsUsed ?? DEFAULT_REFERENCE_PERIOD_MONTHS;
      return getReferenceIncomeAndCos(
        userId,
        b.locationId,
        yearMonth,
        refMonths,
        context,
      );
    }),
  );
  return budgets.map((b, i) => {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value.cosByCategory) {
      const cosTotal =
        r.value.cosTotal ??
        r.value.cosByCategory.reduce((s, c) => s + c.amount, 0);
      return {
        ...b,
        referenceCosTotal: cosTotal,
        referenceCosByCategory: r.value.cosByCategory,
      };
    }
    return b;
  });
}

export async function getBudgetsByMonth(
  yearMonth: string,
): Promise<BudgetDataType[]> {
  const raw = await prisma.budget.findMany({
    where: { yearMonth },
    include: { location: true },
    orderBy: { location: { createdAt: 'asc' } },
  });
  const filtered = raw.filter(
    (b) =>
      b.location.startYearMonth == null ||
      b.yearMonth >= b.location.startYearMonth,
  );
  return filtered.map(mapBudgetToDataType);
}

export async function ensureBudgetsForMonth(
  yearMonth: string,
  userId: string,
  context: QuickBooksApiContext,
): Promise<void> {
  if (!isValidYearMonth(yearMonth)) return;
  const locations = await prisma.location.findMany({
    select: { id: true, startYearMonth: true },
    orderBy: { createdAt: 'asc' },
  });

  const locationsInScope = locations.filter(
    (loc) =>
      loc.startYearMonth == null || yearMonth >= loc.startYearMonth,
  );

  await Promise.all(
    locationsInScope.map(async (loc) => {
      const existing = await prisma.budget.findUnique({
        where: { locationId_yearMonth: { locationId: loc.id, yearMonth } },
        select: { id: true, error: true },
      });
      if (!existing || existing.error != null) {
        await ensureBudgetForMonth({
          locationId: loc.id,
          yearMonth,
          userId,
          context,
        });
      }
    }),
  );
}

export async function getLocationsByIds(
  ids: string[],
): Promise<{ id: string; code: string; name: string }[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.location.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, name: true },
  });
  return rows;
}
