import 'server-only';
import type { PaymentMethod } from '@/generated/prisma/client';
import { dbDate, monthStart, todayInDhaka, addMonths, ymdFromDb, type Ymd } from '@/lib/dates';
import { can, type Ctx } from '@/server/authz';
import { scopeOf, withTenant } from '@/server/db/tenant';
import type { Tx } from '@/server/db/client';
import { visibleCasesWhere, type CaseType } from '@/features/cases/queries';

/**
 * Fees, payments and dues (F9–F12). Readable only with P9 (owner, or an associate the owner allowed);
 * the database enforces the same rule. Associates see money only for cases they can open.
 */
export type CaseRef = { id: string; type: CaseType; number: string; year: string };
export type DueRow = { case: CaseRef; clientId: string | null; clientName: string | null; duePoisha: number };
export type PaymentRow = {
  id: string;
  receiptNo: number;
  amountPoisha: number;
  method: PaymentMethod;
  reference: string | null;
  description: string;
  paidOn: Ymd;
  clientName: string | null;
  case: CaseRef;
};

const caseRefSelect = { id: true, type: true, number: true, year: true } as const;

async function totalsByCase(tx: Tx, ctx: Ctx, caseIds?: string[]) {
  const where = { chamberId: ctx.chamberId, ...(caseIds ? { caseId: { in: caseIds } } : {}) };
  const [fees, paid] = await Promise.all([
    tx.fee.groupBy({ by: ['caseId'], where: { ...where, deletedAt: null }, _sum: { amountPoisha: true } }),
    tx.payment.groupBy({ by: ['caseId'], where, _sum: { amountPoisha: true } }),
  ]);
  const out = new Map<string, { charged: number; paid: number }>();
  for (const f of fees) out.set(f.caseId, { charged: f._sum.amountPoisha ?? 0, paid: 0 });
  for (const p of paid) out.set(p.caseId, { charged: out.get(p.caseId)?.charged ?? 0, paid: p._sum.amountPoisha ?? 0 });
  return out;
}

/** Fee tab on a case: charges, payments and what is still due. */
export async function caseMoney(ctx: Ctx, caseId: string) {
  if (!can.viewFees(ctx)) return null;
  return withTenant(scopeOf(ctx), async (tx) => {
    const kase = await tx.case.findFirst({
      where: { AND: [visibleCasesWhere(ctx), { id: caseId }] },
      select: { id: true },
    });
    if (!kase) return null;
    const [fees, payments] = await Promise.all([
      tx.fee.findMany({ where: { caseId, chamberId: ctx.chamberId, deletedAt: null }, orderBy: { chargedOn: 'desc' } }),
      tx.payment.findMany({ where: { caseId, chamberId: ctx.chamberId }, orderBy: { receiptNo: 'desc' } }),
    ]);
    const charged = fees.reduce((s, f) => s + f.amountPoisha, 0);
    const paid = payments.reduce((s, p) => s + p.amountPoisha, 0);
    return {
      fees: fees.map((f) => ({
        id: f.id,
        description: f.description,
        amountPoisha: f.amountPoisha,
        chargedOn: ymdFromDb(f.chargedOn),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        receiptNo: p.receiptNo,
        amountPoisha: p.amountPoisha,
        method: p.method,
        reference: p.reference,
        description: p.description,
        paidOn: ymdFromDb(p.paidOn),
      })),
      chargedPoisha: charged,
      paidPoisha: paid,
      duePoisha: charged - paid,
    };
  });
}

/** Accounts screen (Accounts design): this month's collection, total dues, the dues list and recent payments. */
export async function accountsOverview(ctx: Ctx) {
  if (!can.viewFees(ctx)) return null;
  const today = todayInDhaka();
  const start = monthStart(today);
  return withTenant(scopeOf(ctx), async (tx) => {
    const cases = await tx.case.findMany({
      where: visibleCasesWhere(ctx),
      select: { ...caseRefSelect, clientId: true, client: { select: { displayName: true } } },
    });
    const byId = new Map(cases.map((c) => [c.id, c]));
    const totals = await totalsByCase(tx, ctx, ctx.role === 'owner' ? undefined : cases.map((c) => c.id));
    const dues: DueRow[] = [];
    for (const [caseId, t] of totals) {
      const c = byId.get(caseId);
      if (!c || t.charged - t.paid <= 0) continue;
      dues.push({
        case: { id: c.id, type: c.type, number: c.number, year: c.year },
        clientId: c.clientId,
        clientName: c.client?.displayName ?? null,
        duePoisha: t.charged - t.paid,
      });
    }
    dues.sort((a, b) => b.duePoisha - a.duePoisha);

    const visible = { chamberId: ctx.chamberId, caseInChamber: visibleCasesWhere(ctx) };
    const [month, recent] = await Promise.all([
      tx.payment.aggregate({
        where: { ...visible, paidOn: { gte: dbDate(start), lt: dbDate(addMonths(start, 1)) } },
        _sum: { amountPoisha: true },
      }),
      tx.payment.findMany({ where: visible, orderBy: [{ paidOn: 'desc' }, { receiptNo: 'desc' }], take: 20 }),
    ]);
    return {
      monthStart: start,
      monthPoisha: month._sum.amountPoisha ?? 0,
      duePoisha: dues.reduce((s, d) => s + d.duePoisha, 0),
      dues,
      recent: recent.map((p): PaymentRow => {
        const c = byId.get(p.caseId)!;
        return {
          id: p.id,
          receiptNo: p.receiptNo,
          amountPoisha: p.amountPoisha,
          method: p.method,
          reference: p.reference,
          description: p.description,
          paidOn: ymdFromDb(p.paidOn),
          clientName: c?.client?.displayName ?? null,
          case: { id: p.caseId, type: c?.type, number: c?.number, year: c?.year },
        };
      }),
    };
  });
}

/** Cases offered in the payment form, with what each still owes. */
export async function paymentCaseOptions(ctx: Ctx) {
  if (!can.recordMoney(ctx)) return [];
  return withTenant(scopeOf(ctx), async (tx) => {
    const cases = await tx.case.findMany({
      where: { ...visibleCasesWhere(ctx), status: 'active' },
      select: { ...caseRefSelect, client: { select: { displayName: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    const totals = await totalsByCase(tx, ctx);
    return cases.map((c) => {
      const t = totals.get(c.id);
      return { ...c, clientName: c.client?.displayName ?? null, duePoisha: t ? t.charged - t.paid : 0 };
    });
  });
}

/** Everything printed on a receipt (ReceiptView design). */
export async function receiptData(ctx: Ctx, paymentId: string) {
  if (!can.viewFees(ctx)) return null;
  return withTenant(scopeOf(ctx), async (tx) => {
    const p = await tx.payment.findFirst({
      where: { id: paymentId, chamberId: ctx.chamberId, caseInChamber: visibleCasesWhere(ctx) },
      include: {
        caseInChamber: { select: caseRefSelect },
        clientInChamber: { select: { id: true, displayName: true } },
      },
    });
    if (!p) return null;
    const [chamber, receiver] = await Promise.all([
      tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { name: true, address: true } }),
      tx.membership.findFirst({
        where: { chamberId: ctx.chamberId, userId: p.receivedBy },
        select: { role: true, user: { select: { name: true } } },
      }),
    ]);
    return {
      id: p.id,
      receiptNo: p.receiptNo,
      paidOn: ymdFromDb(p.paidOn),
      amountPoisha: p.amountPoisha,
      method: p.method,
      reference: p.reference,
      description: p.description,
      client: p.clientInChamber,
      case: p.caseInChamber,
      chamber,
      receivedBy: receiver ? { name: receiver.user.name, role: receiver.role } : null,
    };
  });
}
