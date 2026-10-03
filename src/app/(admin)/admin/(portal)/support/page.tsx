import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/server/admin/session';
import { supportGrants } from '@/features/admin-portal/queries';
import { AdminPageHeader, HowSupportWorks, adminFormat } from '@/features/admin-portal/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.nav');
  return { title: t('support') };
}

/** All support requests. Requests are sent from a chamber's page; owners decide in their app. */
export default async function AdminSupport() {
  const admin = await requireAdmin();
  const t = await getTranslations('admin');
  const f = await adminFormat();
  const grants = await supportGrants();
  return (
    <>
      <AdminPageHeader title={t('nav.support')} subtitle={t('support.subtitle')} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-x-auto rounded-card border border-border bg-surface px-5">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="text-[13px] text-muted">
                <th scope="col" className="py-3 font-semibold">
                  {t('chambers.colChamber')}
                </th>
                <th scope="col" className="py-3 font-semibold">
                  {t('support.by')}
                </th>
                <th scope="col" className="py-3 font-semibold">
                  {t('support.requested')}
                </th>
                <th scope="col" className="py-3 font-semibold">
                  {t('support.stateLabel')}
                </th>
                <th scope="col" className="py-3">
                  <span className="sr-only">{t('support.open')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} className="border-t border-border align-top">
                  <td className="py-3">
                    <Link href={`/admin/chambers/${g.chamberId}`} className="font-semibold text-accent">
                      {g.chamberName}
                    </Link>
                    <p className="max-w-[360px] pt-1 text-[13px] text-muted">{g.reason}</p>
                  </td>
                  <td className="py-3">{g.adminName}</td>
                  <td className="py-3">{f.dateTime(g.requestedAt)}</td>
                  <td className="py-3">
                    {t(`support.state.${g.state}`)}
                    {g.state === 'active' && g.expiresAt && (
                      <span className="block text-[13px] text-muted">
                        {t('support.until', { time: f.dateTime(g.expiresAt) })}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {g.state === 'active' && g.adminId === admin.id && (
                      <Link href={`/admin/support/${g.chamberId}`} className="font-semibold text-accent underline">
                        {t('support.open')}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {grants.length === 0 && (
                <tr className="border-t border-border">
                  <td colSpan={5} className="py-4 text-muted">
                    {t('support.noneYet')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <HowSupportWorks />
      </div>
    </>
  );
}
