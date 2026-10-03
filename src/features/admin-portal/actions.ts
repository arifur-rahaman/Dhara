'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { normalizeBdPhone } from '@/lib/phone';
import { isYmd, dbDate } from '@/lib/dates';
import { adminAudit } from '@/server/admin/audit';
import { createAdminSession, endAdminSession, getAdmin, requireAdmin } from '@/server/admin/session';
import { clearFailures, recordFailure, tooManyFailures } from '@/server/auth/attempts';
import { verifyPasswordOrDummy } from '@/server/auth/password';
import { checkTotp } from '@/server/auth/totp';
import { adminDb, withAdmin } from '@/server/db/admin-client';
import { requestIpHash } from '@/server/request';
import type { FormState } from '@/features/auth/actions';
import { chamberStatuses, plans } from './plans';

/** Admin sign-in: phone, password and an authenticator code, every time (TECH_GUIDE section 5). */
export async function adminSignIn(_: FormState, form: FormData): Promise<FormState> {
  const raw = String(form.get('phone') ?? '');
  const phone = normalizeBdPhone(raw);
  const password = String(form.get('password') ?? '');
  const code = String(form.get('code') ?? '').replace(/\s/g, '');
  const values = { phone: raw };
  if (!phone || !password || !code) return { error: 'adminCredentialsInvalid', values };

  const ipHash = await requestIpHash();
  const keys = [`admin:${phone}`, ...(ipHash ? [`admin-ip:${ipHash}`] : [])];
  for (const key of keys) {
    if (await tooManyFailures(key, 5, adminDb)) return { error: 'tooManyAttempts', values };
  }

  const admin = await adminDb.platformAdmin.findUnique({ where: { phone } });
  const passwordOk = await verifyPasswordOrDummy(admin?.passwordHash, password);
  const totp =
    admin && passwordOk ? await checkTotp(admin.totpSecretEnc, code, admin.totpLastStep) : { ok: false as const };
  if (!admin || admin.disabledAt || !passwordOk || !totp.ok) {
    for (const key of keys) await recordFailure(key, adminDb);
    return { error: 'adminCredentialsInvalid', values };
  }

  await adminDb.platformAdmin.updateMany({ where: { id: admin.id }, data: { totpLastStep: totp.step } });
  for (const key of keys) await clearFailures(key, adminDb);
  await createAdminSession(admin.id);
  await adminAudit(adminDb, {
    adminId: admin.id,
    action: 'admin.sign_in',
    entity: 'admin',
    entityId: admin.id,
    ipHash,
  });
  redirect('/admin/dashboard');
}

export async function adminSignOut() {
  const admin = await getAdmin();
  if (admin) {
    await adminAudit(adminDb, { adminId: admin.id, action: 'admin.sign_out', entity: 'admin', entityId: admin.id });
  }
  await endAdminSession();
  redirect('/admin/login');
}

const planInput = z.object({
  chamberId: z.uuid(),
  plan: z.enum(plans),
  status: z.enum(chamberStatuses),
  trialEndsAt: z.string().refine((v) => v === '' || isYmd(v)),
});

/** Manual plan assignment (plan.md M3). Only plan, status and trial end can change; the role allows nothing else. */
export async function setChamberPlan(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = {
    plan: String(form.get('plan') ?? ''),
    status: String(form.get('status') ?? ''),
    trialEndsAt: String(form.get('trialEndsAt') ?? ''),
  };
  const parsed = planInput.safeParse({ ...values, chamberId: form.get('chamberId') });
  if (!parsed.success) return { error: 'planInvalid', values };
  const { chamberId, plan, status, trialEndsAt } = parsed.data;
  const ipHash = await requestIpHash();

  const ok = await withAdmin(admin.id, async (tx) => {
    const before = await tx.chamber.findUnique({
      where: { id: chamberId },
      select: { plan: true, status: true, trialEndsAt: true },
    });
    if (!before) return false;
    const trial = trialEndsAt ? dbDate(trialEndsAt) : null;
    await tx.chamber.updateMany({ where: { id: chamberId }, data: { plan, status, trialEndsAt: trial } });
    await adminAudit(tx, {
      adminId: admin.id,
      action: 'chamber.plan_change',
      entity: 'chamber',
      entityId: chamberId,
      chamberId,
      fields: {
        from: { plan: before.plan, status: before.status, trialEndsAt: before.trialEndsAt?.toISOString() ?? null },
        to: { plan, status, trialEndsAt: trial?.toISOString() ?? null },
      },
      ipHash,
    });
    return true;
  });
  if (!ok) return { error: 'planInvalid', values };
  revalidatePath(`/admin/chambers/${chamberId}`);
  return { ok: true, at: Date.now() };
}

const paymentInput = z.object({
  chamberId: z.uuid(),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,7}(\.\d{1,2})?$/),
  method: z.enum(['bkash', 'nagad', 'bank', 'cash', 'other']),
  reference: z.string().trim().max(100),
  paidOn: z.string().refine(isYmd),
});

/** Records a subscription payment received outside the app (plan.md M3). Amounts are stored as poisha. */
export async function recordPayment(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = {
    amount: String(form.get('amount') ?? ''),
    method: String(form.get('method') ?? ''),
    reference: String(form.get('reference') ?? ''),
    paidOn: String(form.get('paidOn') ?? ''),
  };
  const parsed = paymentInput.safeParse({ ...values, chamberId: form.get('chamberId') });
  if (!parsed.success) return { error: 'paymentInvalid', values };
  const { chamberId, amount, method, reference, paidOn } = parsed.data;
  const [taka, fraction = ''] = amount.split('.');
  const amountPoisha = Number(taka) * 100 + Number(fraction.padEnd(2, '0'));
  if (amountPoisha <= 0) return { error: 'paymentInvalid', values };
  const ipHash = await requestIpHash();

  const ok = await withAdmin(admin.id, async (tx) => {
    const exists = await tx.chamber.findUnique({ where: { id: chamberId }, select: { id: true } });
    if (!exists) return false;
    const payment = await tx.subscriptionPayment.create({
      data: {
        chamberId,
        amountPoisha,
        method,
        reference: reference || null,
        paidOn: dbDate(paidOn),
        recordedBy: admin.id,
      },
      select: { id: true },
    });
    await adminAudit(tx, {
      adminId: admin.id,
      action: 'payment.record',
      entity: 'subscription_payment',
      entityId: payment.id,
      chamberId,
      fields: { amountPoisha, method },
      ipHash,
    });
    return true;
  });
  if (!ok) return { error: 'paymentInvalid', values };
  revalidatePath(`/admin/chambers/${chamberId}`);
  return { ok: true, at: Date.now() };
}

/** Asks the chamber owner for support access. The database function logs it for the owner and the platform. */
export async function requestSupport(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const reason = String(form.get('reason') ?? '').trim();
  const chamberId = z.uuid().safeParse(form.get('chamberId'));
  if (!chamberId.success || reason.length < 10 || reason.length > 1000) {
    return { error: 'reasonInvalid', values: { reason } };
  }
  await withAdmin(admin.id, (tx) => tx.$queryRaw`SELECT admin_request_support(${chamberId.data}::uuid, ${reason})`);
  revalidatePath(`/admin/chambers/${chamberId.data}`);
  return { ok: true, at: Date.now() };
}
