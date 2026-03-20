/**
 * Driver app auth: issue and verify JWT for API access.
 * Use Authorization: Bearer <token> in driver app requests.
 * Uses Node crypto (no extra dependency).
 */

import { createHmac, timingSafeEqual } from 'crypto';

const ALG = 'HS256';

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  return Buffer.from(b64, 'base64');
}

function getSecret(): string {
  const secret = process.env.DRIVER_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('DRIVER_JWT_SECRET must be set and at least 16 characters');
  }
  return secret;
}

export type DriverTokenPayload = {
  driverId: string;
  userId: string;
  sub: string;
};

/** Issue a JWT for the driver app. Expires in 30 days. */
export function issueDriverToken(driverId: string, userId: string): string {
  const secret = getSecret();
  const header = { alg: ALG, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    driverId,
    userId,
    sub: userId,
    aud: 'bh-driver',
    iat: now,
    exp: now + 30 * 24 * 60 * 60,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;
  const sig = createHmac('sha256', secret).update(message).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${message}.${sigB64}`;
}

/** Verify Bearer token from request. Returns payload or null. */
export function verifyDriverToken(
  authHeader: string | null,
): DriverTokenPayload | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const secret = getSecret();
    const message = `${headerB64}.${payloadB64}`;
    const expectedSig = createHmac('sha256', secret).update(message).digest();
    const sig = Buffer.from(base64UrlDecode(sigB64));
    if (
      sig.length !== expectedSig.length ||
      !timingSafeEqual(sig, expectedSig)
    ) {
      return null;
    }
    const payloadJson = base64UrlDecode(payloadB64).toString('utf8');
    const payload = JSON.parse(payloadJson) as {
      driverId?: string;
      userId?: string;
      sub?: string;
      aud?: string;
      exp?: number;
    };
    if (
      payload.aud !== 'bh-driver' ||
      (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
    ) {
      return null;
    }
    const driverId = payload.driverId ?? payload.sub;
    const userId = payload.userId ?? payload.sub;
    if (!driverId || !userId) return null;
    return { driverId, userId, sub: userId };
  } catch {
    return null;
  }
}
