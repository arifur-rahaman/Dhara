'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { dbDate, isYmd, todayInDhaka } from '@/lib/dates';
import { uuidv7 } from '@/lib/uuid';
import { assertCan } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import type { FormState } from '@/features/auth/actions';
import { visibleCasesWhere } from './queries';

const digits = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const caseInput = z.object({
  type: z.enum(['civil', 'criminal_cr', 'criminal_gr', 'writ', 'family', 'money_loan', 'other']),
  number: z.string().trim().min(1).max(30),
  year: z
    .string()
    .trim()
    .refine((v) => /^\d{4}$/.test(digits(v)), 'year'),
  courtId: z.uuid(),
  courtNo: optionalText(20),
  ourSide: z.enum(['plaintiff', 'defendant']),
  clientName: optionalText(120),
  assignee: z.string().optional(),
  nextDate: z.string().optional(),
  partiesText: optionalText(300),
  opposingCounsel: optionalText(120),
  note: optionalText(1000),
});

/** Add case (AddCase design). Owner and associate; an associate's case is assigned to them. */
export async function createCase(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('createCase', ctx);
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = caseInput.safeParse(values);
  if (!parsed.success) return { error: 'caseInvalid', values };
  const d = parsed.data;
  const nextDate = d.nextDate?.trim() || null;
  if (nextDate && (!isYmd(nextDate) || nextDate < todayInDhaka())) return { error: 'dateInvalid', values };

  const caseId = uuidv7();
  const result = await withTenant(scopeOf(ctx), async (tx) => {
    // The court must be in the shared directory or belong to this chamber (RLS hides the rest).
    const court = await tx.court.findUnique({ where: { id: d.courtId }, select: { id: true } });
    if (!court) return 'courtInvalid' as const;

    let assigneeMembershipId: string | null = ctx.membershipId;
    if (ctx.role === 'owner' && d.assignee) {
      const member = await tx.membership.findFirst({
        where: { id: d.assignee, chamberId: ctx.chamberId, status: 'active', role: { in: ['owner', 'associate'] } },
        select: { id: true },
      });
      if (!member) return 'caseInvalid' as const;
      assigneeMembershipId = member.id;
    }

    let clientId: string | null = null;
    if (d.clientName) {
      const existing = await tx.client.findFirst({
        where: {
          chamberId: ctx.chamberId,
          deletedAt: null,
          displayName: { equals: d.clientName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      clientId =
        existing?.id ??
        (
          await tx.client.create({
            data: { chamberId: ctx.chamberId, displayName: d.clientName, createdBy: ctx.userId },
          })
        ).id;
    }

    await tx.case.create({
      data: {
        id: caseId,
        chamberId: ctx.chamberId,
        type: d.type,
        number: d.number,
        year: d.year,
        courtId: d.courtId,
        courtNo: d.courtNo,
        ourSide: d.ourSide,
        clientId,
        partiesText: d.partiesText,
        opposingCounsel: d.opposingCounsel,
        note: d.note,
        assigneeMembershipId,
        createdBy: ctx.userId,
      },
    });
    if (nextDate) {
      await tx.hearing.create({
        data: { chamberId: ctx.chamberId, caseId, date: dbDate(nextDate), addedBy: ctx.userId },
      });
    }
    return 'ok' as const;
  });
  if (result !== 'ok') return { error: result, values };
  redirect(`/cases/${caseId}`);
}

const nextDateInput = z.object({
  caseId: z.uuid(),
  date: z.string().refine(isYmd),
  note: optionalText(500),
  serial: optionalText(30),
});

/**
 * Next date (NextDate design, F18): records what happened at the last hearing and adds the new date.
 * Owner, munshi, and associates on cases they can see (P4). Visible to the owner and assignee at once.
 */
export async function addNextDate(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = nextDateInput.safeParse(values);
  if (!parsed.success) return { error: 'dateInvalid', values };
  const { caseId, date, note, serial } = parsed.data;
  const today = todayInDhaka();
  if (date < today) return { error: 'dateInvalid', values };

  const outcome = await withTenant(scopeOf(ctx), async (tx) => {
    const c = await tx.case.findFirst({
      where: { AND: [visibleCasesWhere(ctx), { id: caseId }] },
      select: { id: true, assigneeMembershipId: true },
    });
    if (!c) return 'notFound' as const;
    assertCan('addHearing', ctx, { assigneeMembershipId: c.assigneeMembershipId });

    if (note) {
      // The most recent hearing up to today gets today's note; if there is none, today's entry is created.
      const last = await tx.hearing.findFirst({
        where: { caseId, date: { lte: dbDate(today) }, outcomeNote: null },
        orderBy: { date: 'desc' },
      });
      if (last) await tx.hearing.update({ where: { id: last.id }, data: { outcomeNote: note } });
      else
        await tx.hearing.create({
          data: { chamberId: ctx.chamberId, caseId, date: dbDate(today), outcomeNote: note, addedBy: ctx.userId },
        });
    }
    const same = await tx.hearing.findFirst({ where: { caseId, date: dbDate(date) }, select: { id: true } });
    if (!same) {
      await tx.hearing.create({
        data: { chamberId: ctx.chamberId, caseId, date: dbDate(date), serialOrItem: serial, addedBy: ctx.userId },
      });
    }
    return 'ok' as const;
  });
  if (outcome === 'notFound') return { error: 'caseNotFound', values };
  redirect(`/cases/${caseId}?saved=${date}`);
}
