/**
 * GET /api/quickbook/connect?locationId=xxx
 * Redirects to Intuit OAuth authorize URL. state=locationId so callback can update the right Location.
 */
import {
  getDefaultQuickBooksScopes,
  getQuickBooksOAuthClient,
} from '@/lib/quickbooks';
import { AppError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get('locationId');
    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId is required' },
        { status: 400 },
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    });
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const oauth = getQuickBooksOAuthClient();
    const authUrl = oauth.authorizeUri({
      scope: getDefaultQuickBooksScopes(),
      state: locationId,
    });
    return NextResponse.redirect(authUrl);
  } catch (e) {
    console.error('QuickBooks connect redirect error:', e);
    const message =
      e instanceof AppError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Failed to start QuickBooks connection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
