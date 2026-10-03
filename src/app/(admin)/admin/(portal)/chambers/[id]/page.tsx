import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { isUuid } from '@/lib/ids';
import { todayInDhaka } from '@/lib/dates';
import { requireAdmin } from '@/server/admin/session';
import { PaymentForm, PlanForm, SupportRequestForm } from '@/features/admin-portal/forms';
import { chamberById, chamberGrants, payments } from '@/features/admin-portal/queries';
import { AdminPageHeader, HowSupportWorks, StatusPill, adminFormat } from '@/features/admin-portal/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.nav');
  return { title: t('chambers') };
}

/** One chamber's account: plan, payments and support access. No client or case content. */
export default async function AdminChamberPage({ params }: PageProps<'/admin/chambers/[id]'>) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const chamber = await chamberById(id);
  if (!chamber) notFound();
  const t = await getTranslations();
  const f = await adminFormat();
  const [grants, paid] = await Promise.all([chamberGrants(id), payments(id)]);
  const myActive = grants.find((g) => g.state === 'active' && g.adminId === admin.id);
  const open = grants.some((g) => g.state === 'pending' || g.state === 'active');

  return (
    <>
      <Link
        href="/admin/chambers"
        className="flex h-11 items-center gap-1 self-start text-[14px] font-semibold text-accent"
      >
        <Icon name="back" size={18} />
        {t('admin.nav.chambers')}
      </Link>
      <AdminPageHeader
        title={chamber.name}
        subtitle={`${t(`districts.${chamber.district}`)} · ${t('admin.chamber.since', { date: f.date(chamber.created_at) })}`}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-5 md:grid-cols-4">
            {[
              [t('admin.chambers.colOwner'), chamber.owner_name ?? '—'],
              [t('admin.chamber.ownerPhone'), chamber.owner_phone ?? '—'],
              [t('admin.chambers.colMembers'), f.number(chamber.member_count)],
              [t('admin.chamber.cases'), f.number(chamber.case_count)],
            ].map(([k, val]) => (
              <div key={k} className="flex flex-col gap-1">
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className="text-[15px] font-semibold">{val}</dd>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <dt className="text-[13px] text-muted">{t('admin.chamber.plan')}</dt>
              <dd className="text-[15px] font-semibold">{t(`admin.plans.${chamber.plan}`)}</dd>
            </div>
            <div className="flex flex-col items-start gap-1">
              <dt className="text-[13px] text-muted">{t('admin.chamber.status')}</dt>
              <dd>
                <StatusPill status={chamber.status} />
              </dd>
            </div>
          </dl>

          <PlanForm
            chamberId={chamber.id}
            current={{
              plan: chamber.plan,
              status: chamber.status,
              trialEndsAt: chamber.trial_ends_at ? todayInDhaka(chamber.trial_ends_at) : '',
            }}
          />
          <PaymentForm chamberId={chamber.id} today={todayInDhaka()} />

          <section aria-labelledby="chamber-payments" className="flex flex-col gap-2">
            <h2 id="chamber-payments" className="text-[16px] font-semibold">
              {t('admin.payments.title')}
            </h2>
            {paid.length === 0 ? (
              <p className="rounded-card border border-border bg-surface p-4 text-[14px] text-muted">
                {t('admin.payments.none')}
              </p>
            ) : (
              <ul className="flex flex-col rounded-card border border-border bg-surface px-5">
                {paid.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-3 first:border-t-0"
                  >
                    <span className="text-[15px] font-semibold">{f.taka(p.amountPoisha)}</span>
                    <span className="text-[13px] text-muted">
                      {t(`admin.payments.methods.${p.method}`)}
                      {p.reference && ` · ${p.reference}`} · {f.date(p.paidOn)} · {p.recordedByName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <HowSupportWorks>
          {myActive ? (
            <Link
              href={`/admin/support/${chamber.id}`}
              className="flex h-11 items-center justify-center rounded-[10px] bg-accent text-[15px] font-semibold text-on-accent"
            >
              {t('admin.support.open')}
            </Link>
          ) : open ? (
            <p className="text-[14px] text-muted">{t('admin.support.alreadyOpen')}</p>
          ) : (
            <SupportRequestForm chamberId={chamber.id} />
          )}
          {grants.length > 0 && (
            <ul className="flex flex-col border-t border-border pt-2">
              {grants.map((g) => (
                <li key={g.id} className="flex flex-col gap-0.5 py-2 text-[13px]">
                  <span className="font-semibold">
                    {g.adminName} · {t(`admin.support.state.${g.state}`)}
                  </span>
                  <span className="text-muted">{f.dateTime(g.requestedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </HowSupportWorks>
      </div>
    </>
  );
}
