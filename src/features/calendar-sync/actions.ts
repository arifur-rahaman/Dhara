'use server';

import { revalidatePath } from 'next/cache';
import { requireCtx } from '@/server/context';
import { decryptField } from '@/server/crypto';
import { withTenant } from '@/server/db/tenant';
import { revoke } from '@/server/providers/google-calendar';
import { syncMyCalendar } from './sync';

export async function syncCalendarNow() {
  const ctx = await requireCtx();
  await syncMyCalendar(ctx, { force: true });
  revalidatePath('/settings');
}

/** Disconnects: revokes Google's grant and forgets the token. Events already in the calendar stay there. */
export async function disconnectCalendar() {
  const ctx = await requireCtx();
  const link = await withTenant({ userId: ctx.userId }, async (tx) => {
    const l = await tx.calendarLink.findUnique({ where: { userId: ctx.userId } });
    await tx.calendarEvent.deleteMany({ where: { userId: ctx.userId } });
    await tx.calendarLink.deleteMany({ where: { userId: ctx.userId } });
    return l;
  });
  if (link) await revoke(decryptField(link.refreshTokenEnc));
  revalidatePath('/settings');
}
