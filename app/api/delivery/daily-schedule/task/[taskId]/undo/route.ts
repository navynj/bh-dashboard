/**
 * PATCH /api/delivery/daily-schedule/task/[taskId]/undo
 * Auth: Bearer driver JWT.
 * Clears completion/dismiss flags (completedAt=null, isDismissed=false).
 */

import { verifyDriverToken } from '@/lib/delivery/driver-auth';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const authHeader = _request.headers.get('authorization');
  const payload = verifyDriverToken(authHeader);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { taskId } = await params;

  const task = await prisma.dailyScheduleTask.findFirst({
    where: {
      id: taskId,
      dailyScheduleStop: { driverId: payload.driverId },
    },
    select: { id: true },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const updated = await prisma.dailyScheduleTask.update({
    where: { id: taskId },
    data: { completedAt: null, isDismissed: false },
    select: { id: true, completedAt: true, isDismissed: true },
  });

  return NextResponse.json(updated);
}

