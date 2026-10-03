import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/server/admin/session';
import { payments } from '@/features/admin-portal/queries';
import { AdminPageHeader, adminFormat } from '@/features/admin-portal/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.nav');
  return { title: t('subscriptions') };
}

/** Payments recorded by hand. Plans are changed on each chamber's page. */
export default async function AdminSubscriptions() {
  await requireAdmin();
  const t = await getTranslations('admin');
  const f = await adminFormat();
  const rows = await payments();
  return (
    <>
      <AdminPageHeader title={t('nav.subscriptions')} subtitle={t('payments.subtitle')} />
      <section className="overflow-x-auto rounded-card border border-border bg-surface px-5">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead>
            <tr className="text-[13px] text-muted">
              <th scope="col" className="py-3 font-semibold">
                {t('payments.paidOn')}
              </th>
              <th scope="col" className="py-3 font-semibold">
                {t('chambers.colChamber')}
              </th>
              <th scope="col" className="py-3 font-semibold">
                {t('payments.amount')}
              </th>
              <th scope="col" className="py-3 font-semibold">
                {t('payments.method')}
              </th>
              <th scope="col" className="py-3 font-semibold">
                {t('payments.recordedBy')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-3">{f.date(p.paidOn)}</td>
                <td className="py-3">
                  <Link href={`/admin/chambers/${p.chamberId}`} className="font-semibold text-accent">
                    {p.chamberName}
                  </Link>
                </td>
                <td className="py-3 font-semibold">{f.taka(p.amountPoisha)}</td>
                <td className="py-3">
                  {t(`payments.methods.${p.method}`)}
                  {p.reference && <span className="text-muted"> · {p.reference}</span>}
                </td>
                <td className="py-3">{p.recordedByName}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={5} className="py-4 text-muted">
                  {t('payments.none')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
