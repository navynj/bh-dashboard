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
    name: z
      .string()
      .min(1, 'Name is required')
      .transform((s) => s.trim()),
    role: z.enum(['admin', 'office', 'manager', 'assistant'], {
      message: 'Valid role is required (admin, office, manager, assistant)',
    }),
    locationId: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      data.role !== 'manager' ||
      (data.locationId && data.locationId.length > 0),
    { message: 'Location is required for manager role', path: ['locationId'] },
  );

/** POST /api/onboarding/approve */
export const onboardingApprovePostSchema = z.object({
  userId: z
    .string()
    .min(1, 'userId is required')
    .transform((s) => s.trim()),
});

/** POST /api/onboarding/reject */
export const onboardingRejectPostSchema = z.object({
  userId: z
    .string()
    .min(1, 'userId is required')
    .transform((s) => s.trim()),
  reason: z
    .string()
    .max(2000)
    .transform((s) => s.trim())
    .optional(),
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
  referencePeriodMonths: z.number().int().min(0).max(24).optional(),
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
  referencePeriodMonths: z.number().int().min(0).max(24).optional(),
  referenceData: z
    .object({
      incomeTotal: z.number(),
      cosByCategory: z.array(cosCategorySchema),
    })
    .optional(),
});

/** POST /api/budget/bulk — bulk update budgets in a year-month range */
export const budgetBulkPatchSchema = z
  .object({
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
      .min(0)
      .max(24, 'Reference period must be between 1 and 24 months')
      .optional(),
  })
  .refine((data) => data.fromYearMonth <= data.toYearMonth, {
    message: 'From month must be before or equal to To month',
    path: ['toYearMonth'],
  });

/** PATCH /api/budget/settings */
export const budgetSettingsPatchSchema = z
  .object({
    budgetRate: z
      .number()
      .min(0)
      .max(1, 'budgetRate must be between 0 and 1 (e.g. 0.3 for 30%)')
      .optional(),
    referencePeriodMonths: z
      .number()
      .int()
      .min(0)
      .max(24, 'referencePeriodMonths must be between 1 and 24')
      .optional(),
  })
  .refine(
    (data) =>
      data.budgetRate !== undefined || data.referencePeriodMonths !== undefined,
    { message: 'Provide budgetRate and/or referencePeriodMonths' },
  );

/** PATCH /api/user/[id] */
export const userPatchSchema = z.object({
  name: z
    .string()
    .min(0)
    .transform((s) => s.trim())
    .optional(),
  role: z.enum(['admin', 'office', 'manager', 'assistant']).optional(),
  status: z
    .enum(['pending_onboarding', 'pending_approval', 'active', 'rejected'])
    .optional(),
  locationId: z.string().nullable().optional(),
});

/** POST /api/location */
export const locationPostSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .transform((s) => s.trim()),
  name: z
    .string()
    .min(1, 'Name is required')
    .transform((s) => s.trim()),
  realmId: z.string().min(1, 'Realm is required'),
  classId: z.string().nullable().optional(),
  startYearMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM')
    .nullish(),
  showBudget: z.boolean().optional().default(true),
});

/** PATCH /api/location/[id] */
export const locationPatchSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .transform((s) => s.trim())
    .optional(),
  name: z
    .string()
    .min(1, 'Name is required')
    .transform((s) => s.trim())
    .optional(),
  classId: z.string().nullable().optional(),
  realmId: z.string().min(1, 'Realm is required').optional(),
  startYearMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM')
    .nullish(),
  showBudget: z.boolean().optional(),
});

export type OnboardingPostBody = z.infer<typeof onboardingPostSchema>;
export type OnboardingApprovePostBody = z.infer<
  typeof onboardingApprovePostSchema
>;
export type OnboardingRejectPostBody = z.infer<
  typeof onboardingRejectPostSchema
>;
export type BudgetPostBody = z.infer<typeof budgetPostSchema>;
export type BudgetPatchBody = z.infer<typeof budgetPatchSchema>;
export type BudgetBulkPatchBody = z.infer<typeof budgetBulkPatchSchema>;
export type BudgetSettingsPatchBody = z.infer<typeof budgetSettingsPatchSchema>;
export type UserPatchBody = z.infer<typeof userPatchSchema>;
export type LocationPostBody = z.infer<typeof locationPostSchema>;
export type LocationPatchBody = z.infer<typeof locationPatchSchema>;

// ===============================
// DELIVERY
// ===============================
/** POST /api/delivery/location */
export const deliveryLocationPostSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .transform((s) => s.trim()),
  address: z
    .string()
    .transform((s) => s.trim())
    .optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  locationId: z.string().nullish(),
});
/** PATCH /api/delivery/location/[id] */
export const deliveryLocationPatchSchema = z.object({
  name: z
    .string()
    .min(1)
    .transform((s) => s.trim())
    .optional(),
  address: z
    .string()
    .transform((s) => s.trim())
    .optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  locationId: z.string().nullish(),
});

/** POST /api/delivery/driver */
export const deliveryDriverPostSchema = z.object({
  userId: z.string().min(1, 'User is required'),
  name: z
    .string()
    .transform((s) => s.trim())
    .optional(),
});
/** PATCH /api/delivery/driver/[id] */
export const deliveryDriverPatchSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .optional(),
});

/** POST /api/delivery/fixed-schedule */
export const deliveryFixedSchedulePostSchema = z.object({
  driverId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
});
/** DELETE by driverId + dayOfWeek in body or query */

/** PUT /api/delivery/fixed-schedule/template - set recurring schedule template (stops + tasks) for a driver+weekday */
const fixedScheduleStopSchema = z.object({
  deliveryLocationId: z.string().nullish(),
  name: z.string().min(1),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  tasks: z.array(z.object({ title: z.string().min(1) })).default([]),
});
export const deliveryFixedScheduleTemplatePutSchema = z.object({
  driverId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  stops: z.array(fixedScheduleStopSchema),
});

/** POST /api/delivery/daily-schedule */
export const deliveryDailySchedulePostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  driverId: z.string().min(1),
  stops: z.array(
    z.object({
      deliveryLocationId: z.string().nullish(),
      name: z.string().min(1),
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      tasks: z.array(z.object({ title: z.string().min(1) })).default([]),
    }),
  ),
});
/** POST /api/delivery/daily-schedule/from-fixed - create daily schedules from fixed templates for a date */
export const deliveryDailyScheduleFromFixedPostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});

/** PATCH /api/delivery/daily-schedule/[id] - update stops/tasks order and content */
export const deliveryDailySchedulePatchSchema = z.object({
  stops: z
    .array(
      z.object({
        id: z.string().optional(),
        deliveryLocationId: z.string().nullish(),
        name: z.string().min(1),
        address: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        tasks: z.array(
          z.object({
            id: z.string().optional(),
            title: z.string().min(1),
          }),
        ),
      }),
    )
    .optional(),
});

export type DeliveryLocationPostBody = z.infer<
  typeof deliveryLocationPostSchema
>;
export type DeliveryLocationPatchBody = z.infer<
  typeof deliveryLocationPatchSchema
>;
export type DeliveryDriverPostBody = z.infer<typeof deliveryDriverPostSchema>;
export type DeliveryDriverPatchBody = z.infer<typeof deliveryDriverPatchSchema>;
export type DeliveryFixedSchedulePostBody = z.infer<
  typeof deliveryFixedSchedulePostSchema
>;
export type DeliveryFixedScheduleTemplatePutBody = z.infer<
  typeof deliveryFixedScheduleTemplatePutSchema
>;
export type DeliveryDailySchedulePostBody = z.infer<
  typeof deliveryDailySchedulePostSchema
>;
export type DeliveryDailySchedulePatchBody = z.infer<
  typeof deliveryDailySchedulePatchSchema
>;

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
    return {
      error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) {
    return { data: parsed.data };
  }
  const formErrors = parsed.error.flatten().formErrors;
  const firstIssue = parsed.error.issues[0];
  const message =
    (formErrors[0] as string | undefined) ??
    (firstIssue && 'message' in firstIssue
      ? (firstIssue as { message: string }).message
      : undefined) ??
    'Validation failed';
  return { error: NextResponse.json({ error: message }, { status: 400 }) };
}
