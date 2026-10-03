import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { maskPhone } from '@/lib/phone';
import { requireAdmin } from '@/server/admin/session';
import { adminTeam } from '@/features/admin-portal/queries';
import { AdminPageHeader, adminFormat } from '@/features/admin-portal/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.nav');
  return { title: t('team') };
}

/** Platform admins. Accounts are created on the server with scripts/admin-create.mjs, never from the portal. */
export default async function AdminTeamPage() {
  await requireAdmin();
  const t = await getTranslations('admin');
  const f = await adminFormat();
  const admins = await adminTeam();
  return (
    <>
      <AdminPageHeader title={t('nav.team')} subtitle={t('team.subtitle')} />
      <ul className="flex max-w-[640px] flex-col rounded-card border border-border bg-surface px-5">
        {admins.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0"
          >
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold">{a.name}</span>
              <span className="text-[13px] text-muted">
                {t(`roles.${a.role}`)} · <span lang="en">{maskPhone(a.phone)}</span> · {f.date(a.createdAt)}
              </span>
            </div>
            <span
              className={`rounded-full px-2.5 py-[3px] text-[12px] font-semibold ${a.disabledAt ? 'bg-lock-bg text-lock-text' : 'bg-ok-bg text-ok'}`}
            >
              {a.disabledAt ? t('team.disabled') : t('status.active')}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
