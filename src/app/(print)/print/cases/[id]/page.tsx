import { notFound } from 'next/navigation';
import { isUuid } from '@/lib/ids';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { getCase } from '@/features/cases/queries';
import { HistoryPrint } from '@/features/cases/print-views';

/** Print view of a case's hearing history for the PDF renderer (F6). */
export default async function PrintCaseHistory({ params }: PageProps<'/print/cases/[id]'>) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const c = await getCase(ctx, id);
  if (!c) notFound();
  const chamber = await withTenant(scopeOf(ctx), (tx) =>
    tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { name: true } }),
  );
  return (
    <main data-print-ready className="paper mx-auto max-w-[900px] p-8">
      <style>{'@page { size: A4; margin: 12mm; } html, body { background: #ffffff !important; }'}</style>
      <HistoryPrint c={c} chamber={chamber.name} />
    </main>
  );
}
