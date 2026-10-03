import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { isUuid } from '@/lib/ids';
import { requireAdmin } from '@/server/admin/session';
import { chamberById, supportCases } from '@/features/admin-portal/queries';
import { AdminPageHeader, adminFormat } from '@/features/admin-portal/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.support');
  return { title: t('viewTitle') };
}

/**
 * Support view during an approved grant: case numbers, courts and dates only, through the
 * admin_support_cases function, which checks the grant and logs every call. Client data never reaches this page.
 */
export default async function AdminSupportView({ params }: PageProps<'/admin/support/[chamberId]'>) {
  const admin = await requireAdmin();
  const { chamberId } = await params;
  if (!isUuid(chamberId)) notFound();
  const chamber = await chamberById(chamberId);
  if (!chamber) notFound();
  const t = await getTranslations();
  const f = await adminFormat();

  let rows: Awaited<ReturnType<typeof supportCases>> | null = null;
  try {
    rows = await supportCases(admin, chamberId);
  } catch {
    rows = null;
  }

  return (
    <>
      <Link
        href={`/admin/chambers/${chamberId}`}
        className="flex h-11 items-center gap-1 self-start text-[14px] font-semibold text-accent"
      >
        <Icon name="back" size={18} />
        {chamber.name}
      </Link>
      <AdminPageHeader title={t('admin.support.viewTitle')} subtitle={t('admin.support.viewSubtitle')} />
      {rows === null ? (
        <p role="alert" className="rounded-card bg-lock-bg p-5 text-[15px] text-lock-text">
          {t('admin.support.noGrant')}
        </p>
      ) : (
        <section className="overflow-x-auto rounded-card border border-border bg-surface px-5">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="text-[13px] text-muted">
                <th scope="col" className="py-3 font-semibold">
                  {t('admin.support.colCase')}
                </th>
                <th scope="col" className="py-3 font-semibold">
                  {t('admin.support.colCourt')}
                </th>
                <th scope="col" className="py-3 font-semibold">
                  {t('admin.support.colNext')}
                </th>
                <th scope="col" className="py-3 font-semibold">
                  {t('admin.chamber.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-3 font-semibold">
                    {t(`caseType.${r.case_type}`)} {r.number}/{r.year}
                  </td>
                  <td className="py-3">
                    {r.court_name}
                    {r.court_no && `-${r.court_no}`}
                  </td>
                  <td className="py-3">{r.next_date ? f.date(r.next_date) : '—'}</td>
                  <td className="py-3">{t(`admin.support.caseStatus.${r.status}`)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className="border-t border-border">
                  <td colSpan={4} className="py-4 text-muted">
                    {t('admin.support.noCases')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Icon name="lock" size={16} />
        {t('admin.support.logged')}
      </p>
    </>
  );
}
