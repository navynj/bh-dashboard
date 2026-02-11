/**
 * GET /api/quickbook/auth/callback?code=...&realmId=...&state=locationId
 * Exchanges authorization code for tokens and updates Location. Redirects to /location/[locationId].
 */
import { getQuickBooksOAuthClient } from '@/lib/quickbooks';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const realmId = searchParams.get('realmId');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error(
      'QuickBooks OAuth callback error:',
      error,
      searchParams.get('error_description'),
    );
    return NextResponse.redirect(
      new URL(`/?qb_error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/?qb_error=missing_code_or_state', request.url),
    );
  }

  const locationId = state;

  try {
    const oauth = getQuickBooksOAuthClient();
    const authResponse = await oauth.createToken(request.url);
    const token = authResponse.getJson();
    const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000);

    await prisma.location.update({
      where: { id: locationId },
      data: {
        realmId: token.realmId ?? realmId ?? undefined,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt,
      },
    });

    return NextResponse.redirect(
      new URL(`/location/${locationId}`, request.url),
    );
  } catch (e) {
    console.error('QuickBooks callback error:', e);
    return NextResponse.redirect(new URL('/?qb_error=callback', request.url));
  }
}
