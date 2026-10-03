import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/server/env';
import type { Tx } from './client';

/**
 * Prisma client for the platform admin portal. Connects as dhara_admin (DATABASE_ADMIN_URL), which has
 * no grants on client tables and only account columns of chambers (see the team_tasks_admin migration).
 * Always `select` columns explicitly on chamber tables: a plain findMany asks for columns this role cannot read.
 */
function create() {
  const url = env().DATABASE_ADMIN_URL;
  if (!url) throw new Error('DATABASE_ADMIN_URL is not set. See .env.example.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

const globalForAdmin = globalThis as unknown as { dharaAdminPrisma?: PrismaClient };

function client(): PrismaClient {
  globalForAdmin.dharaAdminPrisma ??= create();
  return globalForAdmin.dharaAdminPrisma;
}

export const adminDb = new Proxy({} as PrismaClient, {
  get(_, key) {
    const c = client();
    const value = Reflect.get(c, key);
    return typeof value === 'function' ? value.bind(c) : value;
  },
});

/** Runs fn in a transaction with app.admin_id set, which the support functions check. */
export function withAdmin<T>(adminId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return adminDb.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.admin_id', ${adminId}, true)`;
    return fn(tx);
  });
}
