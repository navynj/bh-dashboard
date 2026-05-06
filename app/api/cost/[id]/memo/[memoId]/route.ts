import { NextRequest, NextResponse } from 'next/server';
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';

type RouteContext = { params: Promise<{ id: string; memoId: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { memoId } = await context.params;
    const { memo } = await req.json();
    if (!memo?.trim()) {
      return NextResponse.json({ error: 'memo is required' }, { status: 400 });
    }

    const updated = await prisma.costMemo.update({
      where: { id: memoId },
      data: { memo: memo.trim() },
      include: { User: { select: { name: true, email: true } } },
    });

    const { User, ...m } = updated;
    return NextResponse.json({ memo: { ...m, user: User } });
  } catch (err) {
    return toApiErrorResponse(err, 'PUT /api/cost/[id]/memo/[memoId] error:');
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { memoId } = await context.params;
    await prisma.costMemo.delete({ where: { id: memoId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toApiErrorResponse(err, 'DELETE /api/cost/[id]/memo/[memoId] error:');
  }
}
