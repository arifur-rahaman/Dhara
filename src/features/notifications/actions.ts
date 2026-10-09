'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCtx } from '@/server/context';
import { prisma } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import type { FormState } from '@/features/auth/actions';

const subscription = z.object({
  endpoint: z.url().startsWith('https://').max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

/** Saves this device's push subscription for the signed-in person (F5). */
export async function savePushSubscription(input: unknown, userAgent: string): Promise<{ ok: boolean }> {
  const ctx = await requireCtx();
  const parsed = subscription.safeParse(input);
  if (!parsed.success) return { ok: false };
  const s = parsed.data;
  await withTenant(
    { userId: ctx.userId },
    (tx) =>
      tx.$executeRaw`SELECT app_claim_push_endpoint(${s.endpoint}, ${s.keys.p256dh}, ${s.keys.auth}, ${userAgent.slice(0, 200)})`,
  );
  return { ok: true };
}

/** Forgets this device (on turning reminders off here, or signing out). */
export async function removePushSubscription(endpoint: string) {
  const ctx = await requireCtx();
  await withTenant({ userId: ctx.userId }, (tx) =>
    tx.pushSubscription.deleteMany({ where: { endpoint: String(endpoint).slice(0, 1000), userId: ctx.userId } }),
  );
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Night and morning reminder switches and times (Settings design, F5). */
export async function saveReminderPrefs(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const values = {
    nightAt: String(form.get('nightAt') ?? ''),
    morningAt: String(form.get('morningAt') ?? ''),
  };
  const night = hhmm.safeParse(values.nightAt);
  const morning = hhmm.safeParse(values.morningAt);
  if (!night.success || !morning.success) return { error: 'reminderTimeInvalid', values };
  await prisma.user.updateMany({
    where: { id: ctx.userId },
    data: {
      reminderNightOn: form.get('nightOn') === 'on',
      reminderNightAt: night.data,
      reminderMorningOn: form.get('morningOn') === 'on',
      reminderMorningAt: morning.data,
    },
  });
  revalidatePath('/settings');
  return { ok: true, at: Date.now() };
}

export async function markAllNotificationsRead() {
  const ctx = await requireCtx();
  await withTenant({ userId: ctx.userId }, (tx) =>
    tx.notification.updateMany({ where: { userId: ctx.userId, readAt: null }, data: { readAt: new Date() } }),
  );
  revalidatePath('/notifications');
}
