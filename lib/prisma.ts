import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Use DATABASE_URL or fallback so build/static generation succeeds without .env
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://placeholder:placeholder@localhost:5432/placeholder';
const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Cache in all environments so we never create multiple PrismaClients per process.
// Critical on Vercel/serverless to avoid exhausting DB connections.
globalForPrisma.prisma = prisma;
