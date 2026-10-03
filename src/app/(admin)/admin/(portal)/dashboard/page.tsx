import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/server/admin/session';
import { dashboardStats } from '@/features/admin-portal/queries';
import { AdminPageHeader, adminFormat } from '@/features/admin-portal/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.nav');
  return { title: t('dashboard') };
}

/** Platform counts only. Not in the designs; uses the SuperAdmin layout. */
export default async function AdminDashboard() {
  await requireAdmin();
  const t = await getTranslations('admin.dashboard');
  const f = await adminFormat();
  const s = await dashboardStats();
  const cards: [string, number, string?][] = [
    [t('chambers'), s.chambers, '/admin/chambers'],
    [t('trials'), s.trials],
    [t('paid'), s.paid],
    [t('pastDue'), s.past_due],
    [t('members'), s.members],
    [t('pendingSupport'), s.pendingSupport, '/admin/support'],
    [t('activeSupport'), s.activeSupport, '/admin/support'],
  ];
  return (
    <>
      <AdminPageHeader title={t('title')} subtitle={t('subtitle')} />
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(([label, value, href]) => {
          const body = (
            <>
              <span className="text-[28px] font-bold">{f.number(value)}</span>
              <span className="text-[14px] text-muted">{label}</span>
            </>
          );
          return (
            <li key={label}>
              {href ? (
                <Link
                  href={href}
                  className="flex flex-col gap-1 rounded-card border border-border bg-surface p-5 hover:bg-surface-2"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex flex-col gap-1 rounded-card border border-border bg-surface p-5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
