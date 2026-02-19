/**
 * Zod request schemas and validation helper for API routes.
 * Shared error shape: { error: string } with status 400 on validation failure.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Invalid yearMonth; use YYYY-MM');

/** POST /api/onboarding */
export const onboardingPostSchema = z
  .object({
    name: z.string().min(1, 'Name is required').transform((s) => s.trim()),
    role: z.enum(['admin', 'office', 'manager'], {
      message: 'Valid role is required (admin, office, manager)',
    }),
    locationId: z.string().min(1).optional(),
  })
  .refine(
    (data) => data.role !== 'manager' || (data.locationId && data.locationId.length > 0),
    { message: 'Location is required for manager role', path: ['locationId'] },
  );

/** POST /api/onboarding/approve */
export const onboardingApprovePostSchema = z.object({
  userId: z.string().min(1, 'userId is required').transform((s) => s.trim()),
});

/** POST /api/onboarding/reject */
export const onboardingRejectPostSchema = z.object({
  userId: z.string().min(1, 'userId is required').transform((s) => s.trim()),
  reason: z.string().max(2000).transform((s) => s.trim()).optional(),
});

const cosCategorySchema = z.object({
  categoryId: z.string(),
  name: z.string(),
  amount: z.number(),
});

/** POST /api/budget */
export const budgetPostSchema = z.object({
  yearMonth: yearMonthSchema.optional(),
  locationIds: z.array(z.string()).optional(),
  budgetRate: z.number().min(0).max(1).optional(),
  referencePeriodMonths: z.number().int().min(1).max(24).optional(),
  referenceData: z
    .object({
      incomeTotal: z.number(),
      cosByCategory: z.array(cosCategorySchema),
    })
    .optional(),
});

/** PATCH /api/budget/[locationId] */
export const budgetPatchSchema = z.object({
  yearMonth: yearMonthSchema.optional(),
  budgetRate: z.number().min(0).max(1).optional(),
  referencePeriodMonths: z.number().int().min(1).max(24).optional(),
  referenceData: z
    .object({
      incomeTotal: z.number(),
      cosByCategory: z.array(cosCategorySchema),
    })
    .optional(),
});

/** POST /api/budget/bulk — bulk update budgets in a year-month range */
export const budgetBulkPatchSchema = z.object({
  fromYearMonth: yearMonthSchema,
  toYearMonth: yearMonthSchema,
  budgetRate: z
    .number()
    .min(0)
    .max(1, 'Budget rate must be between 0 and 1 (e.g. 0.33 for 33%)')
    .optional(),
  referencePeriodMonths: z
    .number()
    .int()
    .min(1)
    .max(24, 'Reference period must be between 1 and 24 months')
    .optional(),
}).refine(
  (data) => data.fromYearMonth <= data.toYearMonth,
  { message: 'From month must be before or equal to To month', path: ['toYearMonth'] },
);

/** PATCH /api/budget/settings */
export const budgetSettingsPatchSchema = z
  .object({
    budgetRate: z.number().min(0).max(1, 'budgetRate must be between 0 and 1 (e.g. 0.3 for 30%)').optional(),
    referencePeriodMonths: z
      .number()
      .int()
      .min(1)
      .max(24, 'referencePeriodMonths must be between 1 and 24')
      .optional(),
  })
  .refine(
    (data) => data.budgetRate !== undefined || data.referencePeriodMonths !== undefined,
    { message: 'Provide budgetRate and/or referencePeriodMonths' },
  );

/** PATCH /api/users/[id] */
export const userPatchSchema = z.object({
  name: z.string().min(0).transform((s) => s.trim()).optional(),
  role: z.enum(['admin', 'office', 'manager']).optional(),
  status: z.enum(['pending_onboarding', 'pending_approval', 'active', 'rejected']).optional(),
  locationId: z.string().nullable().optional(),
});

/** PATCH /api/locations/[id] */
export const locationPatchSchema = z.object({
  code: z.string().min(1, 'Code is required').transform((s) => s.trim()).optional(),
  name: z.string().min(1, 'Name is required').transform((s) => s.trim()).optional(),
  classId: z.string().nullable().optional(),
});

export type OnboardingPostBody = z.infer<typeof onboardingPostSchema>;
export type OnboardingApprovePostBody = z.infer<typeof onboardingApprovePostSchema>;
export type OnboardingRejectPostBody = z.infer<typeof onboardingRejectPostSchema>;
export type BudgetPostBody = z.infer<typeof budgetPostSchema>;
export type BudgetPatchBody = z.infer<typeof budgetPatchSchema>;
export type BudgetBulkPatchBody = z.infer<typeof budgetBulkPatchSchema>;
export type BudgetSettingsPatchBody = z.infer<typeof budgetSettingsPatchSchema>;
export type UserPatchBody = z.infer<typeof userPatchSchema>;
export type LocationPatchBody = z.infer<typeof locationPatchSchema>;

/**
 * Parse and validate JSON body. Returns either { data } or { error: NextResponse }.
 * Use: const result = await parseBody(request, schema); if (result.error) return result.error;
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { error: NextResponse }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) {
    return { data: parsed.data };
  }
  const formErrors = parsed.error.flatten().formErrors;
  const firstIssue = parsed.error.issues[0];
  const message =
    (formErrors[0] as string | undefined) ??
    (firstIssue && 'message' in firstIssue ? (firstIssue as { message: string }).message : undefined) ??
    'Validation failed';
  return { error: NextResponse.json({ error: message }, { status: 400 }) };
}
