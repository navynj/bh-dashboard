import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { parseBody, supplierGroupBulkDeliveryScheduleSchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import { parseSupplierDeliverySchedule } from '@/lib/order/supplier-delivery-schedule';
import { Prisma } from '@prisma/client';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Sets the same `deliverySchedule` on every supplier in this group.
 * `deliverySchedule: null` clears the schedule for all members.
 */
export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const { id: groupId } = await ctx.params;
    const result = await parseBody(request, supplierGroupBulkDeliveryScheduleSchema);
    if ('error' in result) return result.error;

    const group = await prisma.supplierGroup.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const { deliverySchedule } = result.data;
    const prismaValue: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      deliverySchedule === null
        ? Prisma.JsonNull
        : (parseSupplierDeliverySchedule(deliverySchedule) as Prisma.InputJsonValue);

    const updateResult = await prisma.supplier.updateMany({
      where: { groupId },
      data: { deliverySchedule: prismaValue },
    });

    return NextResponse.json({
      ok: true,
      updatedCount: updateResult.count,
    });
  } catch (err: unknown) {
    return toApiErrorResponse(
      err,
      'PATCH /api/supplier-groups/[id]/delivery-schedule error:',
    );
  }
}
