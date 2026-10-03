import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { maskPhone } from '@/lib/phone';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { withTenant } from '@/server/db/tenant';
import { revokeInvitation } from '@/features/team/actions';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('team') };
}

/**
 * Team & permissions (docs/design/TeamRoles.dc.html), owner only (P10).
 * M1: members and open invitations. The permission table and per-person settings come in M3.
 */
export default async function TeamPage({ searchParams }: PageProps<'/team'>) {
  const ctx = await requireCtx();
  if (!can.manageTeam(ctx)) notFound();
  const t = await getTranslations();
  const invited = (await searchParams).invited === '1';

  const { members, invitations } = await withTenant({ chamberId: ctx.chamberId, userId: ctx.userId }, async (tx) => ({
    members: await tx.membership.findMany({
      where: { chamberId: ctx.chamberId, status: 'active' },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    invitations: await tx.invitation.findMany({
      where: { chamberId: ctx.chamberId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <SubpageHeader title={t('nav.team')} />
          <p className="text-[15px] text-muted">{t('team.subtitle')}</p>
        </div>
        <Link
          href="/team/invite"
          className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-accent px-[18px] text-[15px] font-semibold text-on-accent"
        >
          <span aria-hidden="true" className="text-[20px] leading-none">
            +
          </span>
          {t('team.add')}
        </Link>
      </div>

      {invited && (
        <p role="status" className="rounded-[12px] bg-ok-bg px-4 py-3 text-[15px] text-ok">
          {t('team.invitedNotice')}
        </p>
      )}

      <section
        aria-labelledby="team-members"
        className="flex max-w-[480px] flex-col rounded-card border border-border bg-surface px-5 pt-4 pb-2"
      >
        <div className="flex items-baseline justify-between pb-2.5">
          <h2 id="team-members" className="text-[16px] font-semibold">
            {t('team.members')}
          </h2>
          <span className="text-[13px] text-muted">
            {t('team.count', { count: members.length + invitations.length })}
          </span>
        </div>
        <ul>
          {members.map((m) => (
            <li key={m.id} className="flex min-h-16 items-center gap-3 border-t border-border">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-title text-[16px]"
              >
                {(m.user.name ?? '?').trim().charAt(0)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">
                  {m.userId === ctx.userId ? t('team.you') : m.user.name}
                </span>
                <span className="text-[13px] text-muted">{t(`roles.${m.role}`)}</span>
              </div>
              <span className="rounded-full bg-ok-bg px-2.5 py-[3px] text-[12px] font-semibold text-ok">
                {t('team.active')}
              </span>
            </li>
          ))}
          {invitations.map((inv) => (
            <li key={inv.id} className="flex min-h-16 items-center gap-3 border-t border-border py-2">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-title text-[16px]"
              >
                {inv.name.trim().charAt(0)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">{inv.name}</span>
                <span className="text-[13px] text-muted">
                  {t(`roles.${inv.role}`)} · <span lang="en">{maskPhone(inv.phone)}</span>
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="rounded-full bg-lock-bg px-2.5 py-[3px] text-[12px] font-semibold text-lock-text">
                  {t('team.inviteSent')}
                </span>
                <form action={revokeInvitation}>
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <button className="flex h-11 items-center text-[13px] font-semibold text-muted underline">
                    {t('team.withdraw')}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex max-w-[640px] items-start gap-3 rounded-[14px] bg-accent-soft px-[18px] py-4 text-[14px]">
        <Icon name="shield" size={20} className="mt-0.5 shrink-0 text-accent" />
        <span>{t('team.matrixLater')}</span>
      </p>
    </div>
  );
}
