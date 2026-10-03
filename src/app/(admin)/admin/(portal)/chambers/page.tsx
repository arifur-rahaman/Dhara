import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { requireAdmin } from '@/server/admin/session';
import { chamberOverview, latestSupport } from '@/features/admin-portal/queries';
import { AdminPageHeader, HowSupportWorks, StatusPill, SupportCell, adminFormat } from '@/features/admin-portal/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.nav');
  return { title: t('chambers') };
}

const cols =
  'grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,1.4fr)] items-center gap-3';

/** Chamber list (docs/design/SuperAdmin.dc.html): account fields and counts only. */
export default async function AdminChambersPage({ searchParams }: PageProps<'/admin/chambers'>) {
  await requireAdmin();
  const t = await getTranslations('admin');
  const f = await adminFormat();
  const q = typeof (await searchParams).q === 'string' ? String((await searchParams).q).slice(0, 100) : '';
  const rows = await chamberOverview(q);
  const support = await latestSupport(rows.map((r) => r.id));

  return (
    <>
      <AdminPageHeader title={t('nav.chambers')} subtitle={t('chambers.subtitle')}>
        <form role="search" className="flex flex-col gap-1.5">
          <label htmlFor="admin-search" className="text-[13px] font-semibold">
            {t('chambers.search')}
          </label>
          <input
            id="admin-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t('chambers.searchPlaceholder')}
            className="h-11 w-[280px] rounded-[10px] border border-border bg-surface px-3.5 text-[15px]"
          />
        </form>
      </AdminPageHeader>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-label={t('chambers.listLabel')}
          className="flex flex-col overflow-x-auto rounded-card border border-border bg-surface px-5 pt-2 pb-1"
        >
          <div className="min-w-[720px]">
            <div className={`${cols} min-h-11 text-[13px] font-semibold text-muted`} aria-hidden="true">
              <span>{t('chambers.colChamber')}</span>
              <span>{t('chambers.colOwner')}</span>
              <span>{t('chambers.colPlan')}</span>
              <span>{t('chambers.colMembers')}</span>
              <span>{t('chambers.colStatus')}</span>
              <span>{t('chambers.colSupport')}</span>
            </div>
            <ul>
              {rows.map((ch) => (
                <li key={ch.id} className="border-t border-border">
                  <Link
                    href={`/admin/chambers/${ch.id}`}
                    className={`${cols} min-h-[60px] py-2 text-[14px] hover:bg-surface-2`}
                  >
                    <span className="text-[15px] font-semibold">{ch.name}</span>
                    <span>{ch.owner_name ?? '—'}</span>
                    <span>{t(`plans.${ch.plan}`)}</span>
                    <span>{f.number(ch.member_count)}</span>
                    <StatusPill status={ch.plan === 'trial' && ch.status === 'active' ? 'trial' : ch.status} />
                    <SupportCell s={support.get(ch.id)} />
                  </Link>
                </li>
              ))}
              {rows.length === 0 && (
                <li className="border-t border-border py-4 text-[14px] text-muted">{t('chambers.none')}</li>
              )}
            </ul>
          </div>
          <p className="flex min-h-[52px] items-center gap-2 border-t border-border text-[13px] text-muted">
            <Icon name="lock" size={16} className="shrink-0" />
            {t('chambers.privacyNote')}
          </p>
        </section>
        <HowSupportWorks />
      </div>
    </>
  );
}
