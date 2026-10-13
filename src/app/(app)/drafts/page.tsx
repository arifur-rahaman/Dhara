import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { caseDisplay } from '@/features/cases/display';
import { listCases } from '@/features/cases/queries';
import { partyNames } from '@/features/drafting/server';
import { DraftStudio } from '@/features/drafting/studio';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('drafts');
  return { title: t('title') };
}

/** AI drafts (AIDraft design, F33). Owners and associates (P8). */
export default async function DraftsPage() {
  const ctx = await requireCtx();
  if (!can.useAi(ctx)) notFound();
  const t = await getTranslations();
  const d = await caseDisplay();
  const [cases, recent] = await Promise.all([
    listCases(ctx),
    withTenant(scopeOf(ctx), async (tx) => {
      const rows = await tx.aiDraft.findMany({
        where: { chamberId: ctx.chamberId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, kind: true, createdAt: true, createdBy: true },
      });
      return rows;
    }),
  ]);
  const caseNames = await withTenant(scopeOf(ctx), async (tx) => {
    const rows = await tx.case.findMany({
      where: { id: { in: cases.map((c) => c.id) } },
      select: { id: true, partiesText: true, client: { select: { displayName: true } } },
    });
    return Object.fromEntries(
      rows.map((r) => [r.id, [r.client?.displayName ?? '', ...partyNames(r.partiesText)].filter(Boolean)]),
    );
  });

  return (
    <div className="flex max-w-[720px] flex-col gap-3.5">
      <SubpageHeader title={t('drafts.title')} />
      <DraftStudio cases={cases.map((c) => ({ id: c.id, label: d.title(c) }))} caseNames={caseNames} />
      {recent.length > 0 && (
        <section aria-labelledby="drafts-recent" className="flex flex-col gap-2 pt-2">
          <h2 id="drafts-recent" className="text-[16px] font-semibold">
            {t('drafts.recent')}
          </h2>
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {recent.map((r) => (
              <li key={r.id} className="border-t border-border first:border-t-0">
                <Link href={`/drafts/${r.id}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="text-[15px] font-semibold">{t(`drafts.kinds.${r.kind}`)}</span>
                  <span className="text-[13px] text-muted">
                    {d.medium(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(r.createdAt))}
                    {r.createdBy !== ctx.userId ? ` · ${t('drafts.byOther')}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
