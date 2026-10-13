import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { deleteDraft } from '@/features/drafting/actions';
import { DraftPaper } from '@/features/drafting/paper';
import { PrintButton } from '@/features/drafting/print-button';
import { restore } from '@/features/drafting/redact';
import { openMap } from '@/features/drafting/server';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('drafts');
  return { title: t('title') };
}

/** One saved draft, with names put back for its writer (and the owner). RLS shows only those two. */
export default async function DraftPage({ params }: PageProps<'/drafts/[id]'>) {
  const ctx = await requireCtx();
  if (!can.useAi(ctx)) notFound();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const draft = await withTenant(scopeOf(ctx), (tx) =>
    tx.aiDraft.findFirst({ where: { id: id.data, chamberId: ctx.chamberId, deletedAt: null } }),
  );
  if (!draft) notFound();
  const t = await getTranslations('drafts');
  const text = restore(draft.output, openMap(draft.redactionMapEnc));

  return (
    <div className="flex max-w-[800px] flex-col gap-3.5">
      <div className="print:hidden">
        <SubpageHeader title={t(`kinds.${draft.kind}`)} backHref="/drafts" />
      </div>
      {draft.removedCitations > 0 && (
        <p className="text-[13px] text-lock-text print:hidden">
          {t('removedCitations', { count: draft.removedCitations })}
        </p>
      )}
      <DraftPaper text={text} />
      <p className="text-[13px] text-muted">{t('lawyerDecides')}</p>
      <div className="flex gap-2 print:hidden">
        <PrintButton label={t('print')} />
        <form action={deleteDraft}>
          <input type="hidden" name="id" value={draft.id} />
          <button className="h-12 rounded-control border border-border px-4 text-[16px] font-medium text-lock-text">
            {t('delete')}
          </button>
        </form>
      </div>
    </div>
  );
}
