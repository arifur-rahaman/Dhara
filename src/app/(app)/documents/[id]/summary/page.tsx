import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { PrimaryButton } from '@/components/form';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { caseDisplay } from '@/features/cases/display';
import { visibleCasesWhere } from '@/features/cases/queries';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { summarizeDocument } from '@/features/summaries/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('summaries');
  return { title: t('title') };
}

/** F38: a judgment or order and its AI summaries, for owners and associates who can open the document. */
export default async function DocumentSummaryPage({ params, searchParams }: PageProps<'/documents/[id]/summary'>) {
  const ctx = await requireCtx();
  if (!can.useAi(ctx)) notFound();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const error = (await searchParams).error;
  const t = await getTranslations('summaries');
  const d = await caseDisplay();
  const data = await withTenant(scopeOf(ctx), async (tx) => {
    const doc = await tx.document.findFirst({
      where: {
        id: id.data,
        chamberId: ctx.chamberId,
        status: 'ready',
        deletedAt: null,
        caseInChamber: visibleCasesWhere(ctx),
      },
      select: { id: true, title: true, caseId: true },
    });
    if (!doc) return null;
    const [summaries, chamber] = await Promise.all([
      tx.aiSummary.findMany({ where: { documentId: doc.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
      tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { aiPhotoReading: true } }),
    ]);
    return { doc, summaries, on: chamber.aiPhotoReading };
  });
  if (!data) notFound();

  return (
    <div className="flex max-w-[640px] flex-col gap-3.5">
      <SubpageHeader title={t('title')} backHref={`/cases/${data.doc.caseId}?tab=documents`} />
      <p className="text-[16px] font-semibold">{data.doc.title}</p>
      {typeof error === 'string' && (
        <p role="alert" className="rounded-[12px] bg-lock-bg px-3.5 py-2.5 text-[14px] text-lock-text">
          {t.has(`errors.${error}`) ? t(`errors.${error}`) : t('errors.unavailable')}
        </p>
      )}
      {data.on ? (
        <form action={summarizeDocument} className="flex flex-col gap-2">
          <input type="hidden" name="documentId" value={data.doc.id} />
          <PrimaryButton type="submit">{data.summaries.length ? t('again') : t('make')}</PrimaryButton>
          <p className="text-[13px] text-muted">{t('sendNote')}</p>
        </form>
      ) : (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">
          {can.editChamberSettings(ctx) ? t('offOwner') : t('offMember')}{' '}
          {can.editChamberSettings(ctx) && (
            <Link href="/settings#settings-ai" className="font-semibold text-accent">
              {t('openSettings')}
            </Link>
          )}
        </p>
      )}
      {data.summaries.map((s) => (
        <article key={s.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <span className="text-[13px] text-muted">
            {d.medium(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(s.createdAt))}
          </span>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{s.summary}</p>
          <p className="text-[13px] text-muted">{t('check')}</p>
        </article>
      ))}
    </div>
  );
}
