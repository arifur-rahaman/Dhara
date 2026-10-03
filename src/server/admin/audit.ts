import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/server/db/client';

/** Every admin action (plan.md 3.2). Append-only for the admin role; never holds client data. */
export type AdminAction =
  | 'admin.create'
  | 'admin.sign_in'
  | 'admin.sign_out'
  | 'chamber.plan_change'
  | 'payment.record'
  | 'support.request'
  | 'support.view_cases';

export async function adminAudit(
  tx: Pick<Tx, 'adminAuditLog'>,
  entry: {
    adminId: string | null;
    action: AdminAction;
    entity: string;
    entityId?: string | null;
    chamberId?: string | null;
    fields?: Prisma.InputJsonValue;
    ipHash?: string | null;
  },
) {
  await tx.adminAuditLog.createMany({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      chamberId: entry.chamberId ?? null,
      fields: entry.fields,
      ipHash: entry.ipHash ?? null,
    },
  });
}
