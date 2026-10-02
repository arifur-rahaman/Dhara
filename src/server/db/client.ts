import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/server/env';

/**
 * Prisma client for the chamber app. Connects as the RLS-bound app role (DATABASE_URL),
 * never as a superuser or table owner. Tenant data must be read through withTenant().
 */
function create() {
  const url = env().DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

const globalForPrisma = globalThis as unknown as { dharaPrisma?: PrismaClient };

export const prisma = globalForPrisma.dharaPrisma ?? create();
if (process.env.NODE_ENV !== 'production') globalForPrisma.dharaPrisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
