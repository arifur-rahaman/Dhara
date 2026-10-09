import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EmptyState, FolderArt } from '@/components/empty-state';
import { requireCtx } from '@/server/context';
import { DocumentList, KindFilter } from '@/features/documents/document-list';
import { documentKinds, listDocuments } from '@/features/documents/queries';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('documents') };
}

/** Recent documents across the cases this person can open (P5, P6). Uploading happens on each case. */
export default async function DocumentsPage({ searchParams }: PageProps<'/documents'>) {
  const ctx = await requireCtx();
  if (ctx.role === 'staff') notFound();
  const t = await getTranslations();
  const sp = await searchParams;
  const kind = documentKinds.find((k) => k === sp.kind);
  const items = await listDocuments(ctx, { kind, take: 100 });
  if (items.length === 0 && !kind) {
    return (
      <div className="flex min-h-[70dvh] max-w-[640px] flex-col">
        <SubpageHeader title={t('nav.documents')} />
        <EmptyState
          art={<FolderArt />}
          title={t('documents.emptyTitle')}
          body={t('documents.emptyBody')}
          secondary={{ href: '/cases', label: t('documents.emptyCta') }}
        />
      </div>
    );
  }
  return (
    <div className="flex max-w-[640px] flex-col gap-3.5">
      <SubpageHeader title={t('nav.documents')} />
      <p className="text-[14px] text-muted">{t('documents.recentHint')}</p>
      <KindFilter base="/documents" current={kind} />
      <DocumentList items={items} showCase />
      <p className="text-[13px] leading-relaxed text-muted">{t('documents.privateNote')}</p>
    </div>
  );
}
