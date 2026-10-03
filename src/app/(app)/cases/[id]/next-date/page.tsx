import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isUuid } from '@/lib/ids';
import { Icon } from '@/components/icons';
import { requireCtx } from '@/server/context';
import { caseDisplay } from '@/features/cases/display';
import { getCase } from '@/features/cases/queries';
import { NextDateForm } from './next-date-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nextDate');
  return { title: t('title') };
}

/** Next date as a bottom sheet over the case (NextDate design). Works at 390px one-handed. */
export default async function NextDatePage({ params }: PageProps<'/cases/[id]/next-date'>) {
  const ctx = await requireCtx();
  const { id } = await params;
  const c = isUuid(id) ? await getCase(ctx, id) : null;
  if (!c || !c.canAddHearing) notFound();
  const t = await getTranslations();
  const d = await caseDisplay();

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/45 md:items-center md:justify-center">
      <Link href={`/cases/${c.id}`} aria-label={t('app.close')} className="absolute inset-0" />
      <section
        aria-labelledby="nd-title"
        className="relative flex max-h-[92dvh] w-full flex-col gap-3 overflow-y-auto rounded-t-[24px] bg-surface px-5 pt-2.5 pb-6 md:max-w-[440px] md:rounded-[24px]"
      >
        <div aria-hidden="true" className="mx-auto h-[5px] w-10 shrink-0 rounded-[3px] bg-border" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 id="nd-title" className="text-[19px] font-bold">
              {t('nextDate.title')}
            </h1>
            <span className="text-[13px] text-muted">
              {d.title(c)} · {t('nextDate.today', { date: d.short(d.today) })}
            </span>
          </div>
          <Link
            href={`/cases/${c.id}`}
            aria-label={t('app.close')}
            className="flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <Icon name="close" />
          </Link>
        </div>
        <NextDateForm caseId={c.id} today={d.today} />
      </section>
    </div>
  );
}
