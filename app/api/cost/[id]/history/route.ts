import { NextRequest, NextResponse } from 'next/server';
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: costId } = await context.params;
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(sp.get('limit') ?? '10', 10), 50);
    const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10), 0);

    const [entries, total] = await Promise.all([
      prisma.costEditHistory.findMany({
        where: { costId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { User: { select: { name: true, email: true } } },
      }),
      prisma.costEditHistory.count({ where: { costId } }),
    ]);

    return NextResponse.json({
      entries: entries.map(({ User, ...e }) => ({ ...e, user: User })),
      total,
      hasMore: offset + limit < total,
    });
  } catch (err) {
    return toApiErrorResponse(err, 'GET /api/cost/[id]/history error:');
  }
}
