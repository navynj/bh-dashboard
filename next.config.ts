import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  /* Use Webpack for dev (avoid Turbopack): run with `pnpm dev` which uses `next dev --webpack` */
  experimental: {
    // `proxy.ts` buffers the body for auth + route; default 10MB truncates large CSV uploads
    // and breaks multipart parsing (Failed to parse body as FormData).
    proxyClientMaxBodySize: '100mb',
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
