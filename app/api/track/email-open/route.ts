import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/core/prisma';

// 1×1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t');

  if (token) {
    try {
      await prisma.poEmailDelivery.updateMany({
        where: { trackingToken: token, openedAt: null },
        data: { openedAt: new Date() },
      });
    } catch {
      // Never fail a tracking request
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
