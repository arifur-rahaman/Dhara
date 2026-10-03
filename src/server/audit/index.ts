import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/server/db/client';

/**
 * Audit actions (CLAUDE.md rule 5): client-contact views, exports, role and permission changes,
 * invitations, support access, deletions. Sign-in events are recorded too.
 * Never put client contact, OTPs or tokens in `fields`.
 */
export type AuditAction =
  | 'auth.sign_in'
  | 'auth.sign_out'
  | 'auth.totp_enabled'
  | 'auth.password_set'
  | 'chamber.create'
  | 'invitation.create'
  | 'invitation.accept'
  | 'invitation.revoke'
  | 'membership.create'
  | 'membership.role_change'
  | 'membership.revoke'
  | 'membership.permission_change'
  | 'support.approve'
  | 'support.reject'
  | 'support.revoke'
  | 'client_contact.view'
  | 'client_contact.update'
  | 'case.delete';

export async function audit(
  tx: Tx,
  entry: {
    chamberId: string | null;
    actorUserId: string | null;
    actorKind?: 'member' | 'admin' | 'system';
    action: AuditAction;
    entity: string;
    entityId?: string | null;
    fields?: Prisma.InputJsonValue;
    ipHash?: string | null;
  },
) {
  // createMany: a plain INSERT without RETURNING. Rows without a chamber (sign-in events) are
  // deliberately unreadable by the app role, so reading the new row back would violate RLS.
  await tx.auditLog.createMany({
    data: {
      chamberId: entry.chamberId,
      actorUserId: entry.actorUserId,
      actorKind: entry.actorKind ?? 'member',
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      fields: entry.fields,
      ipHash: entry.ipHash ?? null,
    },
  });
}
