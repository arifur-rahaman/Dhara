import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import type { Ctx } from '@/server/authz';
import type { Tx } from '@/server/db/client';

/**
 * In-app notices to other members of the same chamber (the database refuses anyone else).
 * The payload holds ids and numbers only; the text is built when the notice is shown.
 */
export async function notifyMembers(
  tx: Tx,
  ctx: Ctx,
  userIds: (string | null | undefined)[],
  kind: 'hearing.added' | 'task.assigned',
  payload: Prisma.InputJsonValue,
) {
  const targets = [...new Set(userIds.filter((id): id is string => !!id && id !== ctx.userId))];
  if (targets.length === 0) return;
  await tx.notification.createMany({
    data: targets.map((userId) => ({ userId, chamberId: ctx.chamberId, kind, payload })),
  });
}
