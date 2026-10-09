'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/server/audit';
import { hashPassword, PASSWORD_MIN_LENGTH } from '@/server/auth/password';
import { getSession, revokeSessions } from '@/server/auth/session';
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

const textSizes = ['sm', 'md', 'lg'] as const;
export type TextSize = (typeof textSizes)[number];

/** Font size in Settings (small / normal / large), kept on the account so every device follows it. */
export async function setTextSize(input: unknown) {
  const ctx = await requireCtx();
  const textSize = z.enum(textSizes).parse(input);
  await prisma.user.update({ where: { id: ctx.userId }, data: { textSize: textSize === 'md' ? null : textSize } });
  revalidatePath('/', 'layout');
}

/**
 * Log out another device, or every device except this one (TECH_GUIDE section 5).
 * The ended devices' push subscriptions go too, so they stop getting reminders.
 */
export async function signOutDevices(form: FormData) {
  const ctx = await requireCtx();
  const current = (await getSession())!;
  const target = String(form.get('session') ?? '');
  const ended =
    target === 'others'
      ? await revokeSessions(ctx.userId, { notId: current.id })
      : z.uuid().safeParse(target).success && target !== current.id
        ? await revokeSessions(ctx.userId, { id: target })
        : [];
  if (ended.length) {
    await withTenant({ userId: ctx.userId }, async (tx) => {
      await tx.pushSubscription.deleteMany({ where: { userId: ctx.userId, sessionId: { in: ended } } });
      await audit(tx, {
        chamberId: null,
        actorUserId: ctx.userId,
        action: 'auth.sign_out_device',
        entity: 'user',
        entityId: ctx.userId,
        fields: { devices: ended.length },
      });
    });
  }
  revalidatePath('/settings/devices');
}
