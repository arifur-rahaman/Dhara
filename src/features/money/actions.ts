'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { dbDate, isYmd, todayInDhaka } from '@/lib/dates';
import { parseTakaToPoisha } from '@/lib/money';
import { audit } from '@/server/audit';
import { assertCan } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { readClientContact } from '@/features/clients/contact';
import { visibleCasesWhere } from '@/features/cases/queries';
import { getPreferences } from '@/features/preferences/server';
import type { FormState } from '@/features/auth/actions';
import { insertPaymentWithReceipt } from './receipts';

const feeInput = z.object({
  caseId: z.uuid(),
  description: z.string().trim().min(2).max(120),
  chargedOn: z.string().refine(isYmd),
});

/** Owner charges a fee on a case (F9). */
export async function addFee(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('recordMoney', ctx);
  const values = {
    description: String(form.get('description') ?? ''),
    amount: String(form.get('amount') ?? ''),
    chargedOn: String(form.get('chargedOn') ?? '') || todayInDhaka(),
  };
  const parsed = feeInput.safeParse({ ...values, caseId: form.get('caseId') });
  const amountPoisha = parseTakaToPoisha(values.amount);
  if (!amountPoisha) return { error: 'amountInvalid', values };
  if (!parsed.success) return { error: 'feeInvalid', values };
  const ok = await withTenant(scopeOf(ctx), async (tx) => {
    const kase = await tx.case.findFirst({ where: { AND: [visibleCasesWhere(ctx), { id: parsed.data.caseId }] } });
    if (!kase) return false;
    await tx.fee.createMany({
      data: {
        chamberId: ctx.chamberId,
        caseId: kase.id,
        description: parsed.data.description,
        amountPoisha,
        chargedOn: dbDate(parsed.data.chargedOn),
        createdBy: ctx.userId,
      },
    });
    return true;
  });
  if (!ok) return { error: 'feeInvalid', values };
  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath('/accounts');
  return { ok: true, at: Date.now() };
}

/** Owner removes a fee entered by mistake (soft delete, audited). Payments are never removed. */
export async function removeFee(form: FormData) {
  const ctx = await requireCtx();
  assertCan('recordMoney', ctx);
  const id = z.uuid().parse(form.get('feeId'));
  const caseId = await withTenant(scopeOf(ctx), async (tx) => {
    const fee = await tx.fee.findFirst({ where: { id, chamberId: ctx.chamberId, deletedAt: null } });
    if (!fee) return null;
    await tx.fee.updateMany({ where: { id }, data: { deletedAt: new Date() } });
    await audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'fee.delete',
      entity: 'fee',
      entityId: id,
      fields: { caseId: fee.caseId, amountPoisha: fee.amountPoisha },
    });
    return fee.caseId;
  });
  if (caseId) {
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/accounts');
  }
}

const paymentInput = z.object({
  caseId: z.uuid(),
  method: z.enum(['cash', 'bkash', 'nagad', 'bank']),
  reference: z.string().trim().max(60),
  description: z.string().trim().min(2).max(120),
  paidOn: z.string().refine((v) => isYmd(v) && v <= todayInDhaka()),
});

/**
 * Owner records money received (F9, F11) and gets a receipt (F10). The receipt number comes from the
 * chamber's counter inside the same transaction, so numbers are sequential with no gaps or repeats.
 */
export async function recordPayment(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('recordMoney', ctx);
  const values = {
    caseId: String(form.get('caseId') ?? ''),
    amount: String(form.get('amount') ?? ''),
    method: String(form.get('method') ?? 'cash'),
    reference: String(form.get('reference') ?? ''),
    description: String(form.get('description') ?? ''),
    paidOn: String(form.get('paidOn') ?? '') || todayInDhaka(),
  };
  const parsed = paymentInput.safeParse(values);
  const amountPoisha = parseTakaToPoisha(values.amount);
  if (!amountPoisha) return { error: 'amountInvalid', values };
  if (!parsed.success) return { error: 'paymentInvalid', values };
  const v = parsed.data;
  if ((v.method === 'bkash' || v.method === 'nagad') && !v.reference) return { error: 'referenceNeeded', values };

  const paymentId = await withTenant(scopeOf(ctx), async (tx) => {
    const kase = await tx.case.findFirst({
      where: { AND: [visibleCasesWhere(ctx), { id: v.caseId }] },
      select: { id: true, clientId: true },
    });
    if (!kase) return null;
    const payment = await insertPaymentWithReceipt(tx, {
      chamberId: ctx.chamberId,
      caseId: kase.id,
      clientId: kase.clientId,
      amountPoisha,
      method: v.method,
      reference: v.reference || null,
      description: v.description,
      paidOn: dbDate(v.paidOn),
      receivedBy: ctx.userId,
    });
    await audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'payment.record',
      entity: 'payment',
      entityId: payment.id,
      fields: { receiptNo: payment.receiptNo, amountPoisha, method: v.method },
    });
    return payment.id;
  });
  if (!paymentId) return { error: 'paymentInvalid', values };
  revalidatePath('/accounts');
  revalidatePath(`/cases/${v.caseId}`);
  redirect(`/receipts/${paymentId}?new=1`);
}

/**
 * F12 (Stage 1): the owner's "remind" opens their own phone's SMS or WhatsApp with the client's number
 * and a prefilled message. Only the owner can see the number (P1), and the read is audited like any view.
 */
export async function dueReminderLink(
  caseId: string,
  channel: 'sms' | 'whatsapp',
): Promise<{ url: string } | { error: string }> {
  const ctx = await requireCtx();
  assertCan('remindClient', ctx);
  const id = z.uuid().parse(caseId);
  const { locale } = await getPreferences();
  const info = await withTenant(scopeOf(ctx), async (tx) => {
    const kase = await tx.case.findFirst({
      where: { AND: [visibleCasesWhere(ctx), { id }] },
      select: { id: true, type: true, number: true, year: true, clientId: true },
    });
    if (!kase?.clientId) return null;
    const [fees, paid, chamber] = await Promise.all([
      tx.fee.aggregate({ where: { caseId: id, deletedAt: null }, _sum: { amountPoisha: true } }),
      tx.payment.aggregate({ where: { caseId: id }, _sum: { amountPoisha: true } }),
      tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { name: true } }),
    ]);
    return { kase, due: (fees._sum.amountPoisha ?? 0) - (paid._sum.amountPoisha ?? 0), chamber: chamber.name };
  });
  if (!info || info.due <= 0) return { error: 'noDue' };
  const contact = await readClientContact(ctx, info.kase.clientId!);
  if (!contact?.phone) return { error: 'noPhone' };

  const taka = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD').format(info.due / 100);
  const ref = `${info.kase.number}/${info.kase.year}`;
  const text =
    locale === 'bn'
      ? `আসসালামু আলাইকুম। ${ref} নম্বর মামলায় আপনার বকেয়া ৳${taka}। সুবিধামতো পরিশোধ করার অনুরোধ রইল। — ${info.chamber}`
      : `Hello. The amount due on case ${ref} is Tk ${taka}. Please pay when convenient. — ${info.chamber}`;
  const digits = contact.phone.replace(/^\+/, '');
  const url =
    channel === 'whatsapp'
      ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
      : `sms:${contact.phone}?body=${encodeURIComponent(text)}`;
  return { url };
}

/** "Send to client on WhatsApp" on a receipt: owner only, opens WhatsApp with the receipt summary (P1). */
export async function receiptShareLink(paymentId: string): Promise<{ url: string } | { error: string }> {
  const ctx = await requireCtx();
  assertCan('remindClient', ctx);
  const id = z.uuid().parse(paymentId);
  const { locale } = await getPreferences();
  const p = await withTenant(scopeOf(ctx), async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id, chamberId: ctx.chamberId },
      select: {
        receiptNo: true,
        amountPoisha: true,
        clientId: true,
        caseInChamber: { select: { number: true, year: true } },
      },
    });
    const chamber = await tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { name: true } });
    return payment ? { ...payment, chamber: chamber.name } : null;
  });
  if (!p?.clientId) return { error: 'noPhone' };
  const contact = await readClientContact(ctx, p.clientId);
  if (!contact?.phone) return { error: 'noPhone' };
  const nf = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD');
  const no = String(p.receiptNo).padStart(4, '0');
  const ref = `${p.caseInChamber.number}/${p.caseInChamber.year}`;
  const text =
    locale === 'bn'
      ? `${ref} নম্বর মামলার জন্য ৳${nf.format(p.amountPoisha / 100)} পেয়েছি। রসিদ নং ${no}। ধন্যবাদ। — ${p.chamber}`
      : `Received Tk ${nf.format(p.amountPoisha / 100)} for case ${ref}. Receipt no. ${no}. Thank you. — ${p.chamber}`;
  return { url: `https://wa.me/${contact.phone.replace(/^\+/, '')}?text=${encodeURIComponent(text)}` };
}
