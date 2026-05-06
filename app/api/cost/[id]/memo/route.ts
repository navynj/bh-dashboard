import { NextRequest, NextResponse } from 'next/server';
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';
import { LexoRank } from 'lexorank';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: costId } = await context.params;
    const memos = await prisma.costMemo.findMany({
      where: { costId },
      orderBy: { rank: 'asc' },
      include: { User: { select: { name: true, email: true } } },
    });

    return NextResponse.json({
      memos: memos.map(({ User, ...m }) => ({ ...m, user: User })),
    });
  } catch (err) {
    return toApiErrorResponse(err, 'GET /api/cost/[id]/memo error:');
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: costId } = await context.params;
    const { memo } = await req.json();
    if (!memo?.trim()) {
      return NextResponse.json({ error: 'memo is required' }, { status: 400 });
    }

    const last = await prisma.costMemo.findFirst({
      where: { costId },
      orderBy: { rank: 'desc' },
      select: { rank: true },
    });

    const rank = last
      ? LexoRank.parse(last.rank).genNext().toString()
      : LexoRank.middle().toString();

    const created = await prisma.costMemo.create({
      data: { costId, userId: session!.user!.id!, memo: memo.trim(), rank },
      include: { User: { select: { name: true, email: true } } },
    });

    const { User, ...m } = created;
    return NextResponse.json({ memo: { ...m, user: User } }, { status: 201 });
  } catch (err) {
    return toApiErrorResponse(err, 'POST /api/cost/[id]/memo error:');
  }
}
