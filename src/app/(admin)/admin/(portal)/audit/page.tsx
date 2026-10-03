import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/server/admin/session';
import { adminAuditLog } from '@/features/admin-portal/queries';
import { AdminPageHeader, adminFormat } from '@/features/admin-portal/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.nav');
  return { title: t('audit') };
}

/** Every admin action, newest first (plan.md 3.2). */
export default async function AdminAuditPage() {
  await requireAdmin();
  const t = await getTranslations('admin');
  const f = await adminFormat();
  const rows = await adminAuditLog();
  return (
    <>
      <AdminPageHeader title={t('nav.audit')} subtitle={t('audit.subtitle')} />
      <section className="overflow-x-auto rounded-card border border-border bg-surface px-5">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead>
            <tr className="text-[13px] text-muted">
              <th scope="col" className="py-3 font-semibold">
                {t('audit.when')}
              </th>
              <th scope="col" className="py-3 font-semibold">
                {t('audit.who')}
              </th>
              <th scope="col" className="py-3 font-semibold">
                {t('audit.what')}
              </th>
              <th scope="col" className="py-3 font-semibold">
                {t('chambers.colChamber')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-3 whitespace-nowrap">{f.dateTime(r.at)}</td>
                <td className="py-3">{r.adminName || '—'}</td>
                <td className="py-3">
                  {t.has(`audit.actions.${r.action.replace('.', '_')}`)
                    ? t(`audit.actions.${r.action.replace('.', '_')}`)
                    : r.action}
                </td>
                <td className="py-3">{r.chamberName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
