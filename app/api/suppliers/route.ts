import { NextRequest, NextResponse } from 'next/server';
import { auth, getOfficeOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { parseBody, supplierCreateSchema } from '@/lib/api/schemas';
import { toApiErrorResponse } from '@/lib/core/errors';
import { resolveSupplierGroupId } from '@/lib/order/default-supplier-group';
import {
  assertSupplierOrderChannel,
  legacyColumnsFromOrderChannel,
} from '@/lib/order/supplier-order-channel';
import type { Prisma } from '@prisma/client';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    const suppliers = await prisma.supplier.findMany({
      orderBy: { company: 'asc' },
      select: {
        id: true,
        company: true,
        shopifyVendorName: true,
        contactName: true,
        contactEmails: true,
        contactPhone: true,
        preferredCommMode: true,
        orderChannelType: true,
        orderChannelPayload: true,
        groupId: true,
        isFavorite: true,
        link: true,
        notes: true,
        createdAt: true,
        _count: { select: { purchaseOrders: true } },
      },
    });

    return NextResponse.json({ ok: true, suppliers });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'GET /api/suppliers error:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !getOfficeOrAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Office or admin access required' },
        { status: 403 },
      );
    }

    const result = await parseBody(request, supplierCreateSchema);
    if ('error' in result) return result.error;
    const { data } = result;

    const groupId = await resolveSupplierGroupId(prisma, data.groupId);

    const channel = assertSupplierOrderChannel(
      data.orderChannelType,
      data.orderChannelPayload,
    );
    if (!channel.ok) {
      return NextResponse.json(
        { error: 'Invalid order channel' },
        { status: 400 },
      );
    }
    const legacy = legacyColumnsFromOrderChannel(
      data.orderChannelType,
      channel.payload,
    );

    const supplier = await prisma.supplier.create({
      data: {
        company: data.company,
        shopifyVendorName: data.shopifyVendorName ?? null,
        groupId,
        notes: data.notes ?? null,
        orderChannelType: data.orderChannelType,
        orderChannelPayload: channel.payload as unknown as Prisma.InputJsonValue,
        contactName: legacy.contactName,
        contactEmails: legacy.contactEmails,
        link: legacy.link,
        contactPhone: null,
        preferredCommMode: null,
      },
    });

    // Auto-create vendor mapping for shopifyVendorName
    if (data.shopifyVendorName) {
      await prisma.shopifyVendorMapping.upsert({
        where: { vendorName: data.shopifyVendorName },
        create: {
          vendorName: data.shopifyVendorName,
          supplierId: supplier.id,
        },
        update: { supplierId: supplier.id },
      });
    }

    // Create additional vendor alias mappings
    if (data.vendorAliases && data.vendorAliases.length > 0) {
      for (const alias of data.vendorAliases) {
        await prisma.shopifyVendorMapping.upsert({
          where: { vendorName: alias },
          create: { vendorName: alias, supplierId: supplier.id },
          update: { supplierId: supplier.id },
        });
      }
    }

    return NextResponse.json({ ok: true, supplier }, { status: 201 });
  } catch (err: unknown) {
    return toApiErrorResponse(err, 'POST /api/suppliers error:');
  }
}
