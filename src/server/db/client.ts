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

function client(): PrismaClient {
  globalForPrisma.dharaPrisma ??= create();
  return globalForPrisma.dharaPrisma;
}

/** Created on first use, so building the app needs no database settings. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_, key) {
    const c = client();
    const value = Reflect.get(c, key);
    return typeof value === 'function' ? value.bind(c) : value;
  },
});

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
