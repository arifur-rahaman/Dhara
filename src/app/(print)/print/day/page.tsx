import { notFound } from 'next/navigation';
import { isYmd, todayInDhaka } from '@/lib/dates';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { hearingsOn } from '@/features/cases/queries';
import { DailyListPrint } from '@/features/cases/print-views';

/** Print view of one day's hearings for the PDF renderer (F6). Same visibility as the Today screen. */
export default async function PrintDay({ searchParams }: PageProps<'/print/day'>) {
  const ctx = await requireCtx();
  if (!can.listCases(ctx)) notFound();
  const sp = await searchParams;
  const date = typeof sp.date === 'string' && isYmd(sp.date) ? sp.date : todayInDhaka();
  const [items, chamber] = await Promise.all([
    hearingsOn(ctx, date),
    withTenant(scopeOf(ctx), (tx) =>
      tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { name: true } }),
    ),
  ]);
  return (
    <main data-print-ready className="paper mx-auto max-w-[1000px] p-8">
      <style>{'@page { size: A4; margin: 12mm; } html, body { background: #ffffff !important; }'}</style>
      <DailyListPrint date={date} chamber={chamber.name} items={items} />
    </main>
  );
}
