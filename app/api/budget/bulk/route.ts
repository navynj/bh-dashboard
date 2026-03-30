// POST /api/budget/bulk — bulk update budgets in a year-month range (office/admin).
// Streams progress as NDJSON: { type: 'progress', yearMonth, locationCode, locationName, updated } then { type: 'done', updated }.

import { NextRequest, NextResponse } from 'next/server';
import { parseBody, budgetBulkPatchSchema } from '@/lib/api/schemas';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import {
  ensureBudgetForMonth,
  getBudgetsByMonth,
  getOrCreateBudgetSettings,
} from '@/features/dashboard/budget';
import type { QuickBooksApiContext } from '@/features/dashboard/budget';
import { toApiErrorResponse } from '@/lib/core/errors';
import { listYearMonthsInRange } from '@/lib/utils';

function streamLine(
  controller: ReadableStreamDefaultController<Uint8Array>,
  obj: object,
) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'));
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }
    if (!getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Only office or admin can bulk update budgets' },
        { status: 403 },
      );
    }

    const parsed = await parseBody(request, budgetBulkPatchSchema);
    if ('error' in parsed) return parsed.error;
    const body = parsed.data;

    const yearMonths = listYearMonthsInRange(
      body.fromYearMonth,
      body.toYearMonth,
    );
    if (yearMonths.length === 0) {
      return NextResponse.json(
        { error: 'Invalid range: from must be before or equal to to' },
        { status: 400 },
      );
    }

    const settings = await getOrCreateBudgetSettings();
    const defaultRate = Number(settings.budgetRate);
    const defaultPeriod = settings.referencePeriodMonths;

    const context: QuickBooksApiContext = {
      baseUrl: new URL(request.url).origin,
      cookie: request.headers.get('cookie'),
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let updated = 0;
        try {
          for (const yearMonth of yearMonths) {
            const budgets = await getBudgetsByMonth(yearMonth);
            for (const budget of budgets) {
              const rate =
                body.budgetRate ??
                (budget.budgetRateUsed != null
                  ? budget.budgetRateUsed
                  : defaultRate);
              const period =
                body.referencePeriodMonths ??
                budget.referencePeriodMonthsUsed ??
                defaultPeriod;
              await ensureBudgetForMonth({
                locationId: budget.locationId,
                yearMonth,
                userId: session.user.id,
                budgetRate: rate,
                referencePeriodMonths: period,
                context,
              });
              updated += 1;
              streamLine(controller, {
                type: 'progress',
                yearMonth,
                locationCode: budget.location?.code ?? budget.locationId,
                locationName: budget.location?.name ?? '',
                updated,
              });
            }
          }
          streamLine(controller, { type: 'done', updated });
        } catch (err) {
          streamLine(controller, {
            type: 'error',
            error: err instanceof Error ? err.message : 'Bulk update failed',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'POST /api/budget/bulk error:');
  }
}
