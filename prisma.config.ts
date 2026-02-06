import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Fallback for prisma generate when DATABASE_URL is not set (e.g. CI)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://placeholder:placeholder@localhost:5432/placeholder';
}

// Prisma CLI (db push, migrate) needs prepared statements. Use Session mode (port 5432 on pooler).
// Ignore DIRECT_URL if it's the direct host (db.xxx.supabase.co) — unreachable from many networks (P1001).
const databaseUrl = process.env.DATABASE_URL ?? '';
const directUrl = process.env.DIRECT_URL ?? '';
const isPooler6543 =
  databaseUrl.includes(':6543/') && databaseUrl.includes('pooler.supabase.com');
const directUrlIsPooler = directUrl.includes('pooler.supabase.com');
const derivedSessionUrl =
  databaseUrl
    .replace(/:6543\//, ':5432/')
    .replace(/\?pgbouncer=true&?/, '?')
    .replace(/\?$/, '') || databaseUrl;
const cliUrl =
  directUrl && directUrlIsPooler
    ? directUrl
    : isPooler6543
      ? derivedSessionUrl
      : databaseUrl;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url:
      cliUrl ||
      (databaseUrl
        ? env('DATABASE_URL')
        : 'postgresql://placeholder:placeholder@localhost:5432/placeholder'),
  },
});
