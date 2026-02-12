import { NextResponse } from 'next/server';

/**
 * Health check: no auth, no DB. Edge runtime so it never loads Node/Prisma.
 * If this works, the hang is in the Node serverless runtime (e.g. Prisma/DB on cold start).
 */
export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
