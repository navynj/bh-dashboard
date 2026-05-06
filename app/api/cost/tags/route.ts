import { NextRequest, NextResponse } from 'next/server';
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const search = req.nextUrl.searchParams.get('search')?.trim() ?? '';
    const tags = await prisma.tag.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ tags });
  } catch (err) {
    return toApiErrorResponse(err, 'GET /api/cost/tags error:');
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, color } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const tag = await prisma.tag.create({
      data: { name: name.trim(), color: color ?? 'gray' },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (err) {
    return toApiErrorResponse(err, 'POST /api/cost/tags error:');
  }
}
