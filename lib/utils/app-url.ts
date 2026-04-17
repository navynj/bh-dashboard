/**
 * Base URL for server-side fetch() to this app's own API routes.
 * Prefer the incoming request host/proto so SSR hits the same deployment.
 * Relying only on NEXT_PUBLIC_APP_URL often returns HTML (wrong host) when
 * that env points at another environment while you browse localhost or a preview URL.
 */

function firstForwarded(value: string | null): string | undefined {
  if (!value) return undefined;
  const part = value.split(',')[0]?.trim();
  return part || undefined;
}

function inferProto(host: string, forwardedProto: string | undefined): string {
  if (forwardedProto) return forwardedProto;
  const h = host.toLowerCase();
  if (
    h.startsWith('localhost:') ||
    h === 'localhost' ||
    h.startsWith('127.0.0.1:') ||
    h === '127.0.0.1'
  ) {
    return 'http';
  }
  return process.env.NODE_ENV === 'development' ? 'http' : 'https';
}

export function getInternalAppBaseUrl(headers: Headers): string {
  const host =
    firstForwarded(headers.get('x-forwarded-host')) ?? headers.get('host');
  if (host) {
    const proto = inferProto(host, firstForwarded(headers.get('x-forwarded-proto')));
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, '');
  if (vercel) {
    return `https://${vercel}`;
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  return 'http://localhost:3000';
}
