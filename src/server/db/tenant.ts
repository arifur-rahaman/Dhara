import 'server-only';
import type { PrismaClient } from '@/generated/prisma/client';
import { prisma as defaultClient, type Tx } from './client';

export type TenantScope = {
  /** Chamber whose rows this transaction may read and write. */
  chamberId?: string | null;
  /** Signed-in user: lets RLS show the user's own memberships across chambers. */
  userId?: string | null;
  /** Hash of an invitation token the visitor holds (invite accept flow). */
  inviteTokenHash?: string | null;
  /** Signed-in user's phone: shows open invitations sent to that number. */
  userPhone?: string | null;
};

/**
 * Runs fn in a transaction with the RLS context set (TECH_GUIDE section 4).
 * Settings are transaction-local (set_config(..., true)), so they never leak to other requests.
 */
export async function withTenant<T>(
  scope: TenantScope,
  fn: (tx: Tx) => Promise<T>,
  client: PrismaClient = defaultClient,
) {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.chamber_id', ${scope.chamberId ?? ''}, true),
                                set_config('app.user_id', ${scope.userId ?? ''}, true),
                                set_config('app.invite_token_hash', ${scope.inviteTokenHash ?? ''}, true),
                                set_config('app.user_phone', ${scope.userPhone ?? ''}, true)`;
    return fn(tx);
  });
}
