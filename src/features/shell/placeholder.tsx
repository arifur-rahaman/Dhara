import { getTranslations } from 'next-intl/server';
import { SubpageHeader } from './subpage-header';

/** Stand-in for a screen a later milestone builds. Sub-pages (opened from More) get the back header. */
export async function PlaceholderScreen({
  title,
  milestone,
  subpage,
}: {
  title: string;
  milestone: string;
  subpage: boolean;
}) {
  const t = await getTranslations('placeholder');
  return (
    <div className="flex flex-col gap-6">
      {subpage ? <SubpageHeader title={title} /> : <h1 className="page-title">{title}</h1>}
      <div className="rounded-card border border-border bg-surface p-5">
        <h2 className="text-[16px] font-semibold">{t('title')}</h2>
        <p className="mt-1 text-muted">{t('body', { milestone })}</p>
      </div>
    </div>
  );
}
