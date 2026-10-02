'use server';

import { audit } from '@/server/audit';
import { hashPassword, PASSWORD_MIN_LENGTH } from '@/server/auth/password';
import { requireCtx } from '@/server/context';
import { prisma } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';

export type PasswordState = { error?: string; saved?: boolean } | undefined;

/** Sets or changes the signed-in person's password (Argon2id). */
export async function setPassword(_: PasswordState, form: FormData): Promise<PasswordState> {
  const ctx = await requireCtx();
  const password = String(form.get('password') ?? '');
  if (password.length < PASSWORD_MIN_LENGTH || password.length > 200) return { error: 'passwordShort' };
  await prisma.user.update({ where: { id: ctx.userId }, data: { passwordHash: await hashPassword(password) } });
  await withTenant({ chamberId: ctx.chamberId }, (tx) =>
    audit(tx, {
      chamberId: null,
      actorUserId: ctx.userId,
      action: 'auth.password_set',
      entity: 'user',
      entityId: ctx.userId,
    }),
  );
  return { saved: true };
}
