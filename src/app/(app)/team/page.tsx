import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { maskPhone } from '@/lib/phone';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { revokeInvitation } from '@/features/team/actions';
import { matrixRows, type Cell } from '@/features/team/matrix';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('team') };
}

const roles = ['owner', 'associate', 'munshi', 'staff'] as const;

/** Team & permissions (docs/design/TeamRoles.dc.html), owner only (P10). */
export default async function TeamPage({ searchParams }: PageProps<'/team'>) {
  const ctx = await requireCtx();
  if (!can.manageTeam(ctx)) notFound();
  const t = await getTranslations();
  const sp = await searchParams;
  const notice =
    sp.invited === '1'
      ? 'invitedNotice'
      : sp.saved === '1'
        ? 'savedNotice'
        : sp.removed === '1'
          ? 'removedNotice'
          : null;

  const { members, invitations } = await withTenant(scopeOf(ctx), async (tx) => ({
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

  const cell = (c: Cell) => {
    if (c === 'yes')
      return <Icon name="check" size={18} className="text-accent" role="img" aria-label={t('team.matrix.yes')} />;
    if (c === 'lock')
      return <Icon name="lock" size={16} className="text-lock-text" role="img" aria-label={t('team.matrix.locked')} />;
    if (c === 'no')
      return (
        <span className="text-muted" aria-label={t('team.matrix.no')}>
          —
        </span>
      );
    return <span>{t(`team.matrix.${c}`)}</span>;
  };

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

      {notice && (
        <p role="status" className="rounded-[12px] bg-ok-bg px-4 py-3 text-[15px] text-ok">
          {t(`team.${notice}`)}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section
          aria-labelledby="team-members"
          className="flex min-w-0 flex-col rounded-card border border-border bg-surface px-5 pt-4 pb-2"
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
            {members.map((m) => {
              const isOwner = m.role === 'owner';
              const body = (
                <>
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
                    <span className="text-[13px] text-muted">
                      {t(`roles.${m.role}`)}
                      {m.role === 'associate' &&
                        ` · ${t(m.caseScope === 'all' ? 'team.scopeAll' : 'team.scopeAssigned')}`}
                      {m.role === 'associate' && m.canSeeFees && ` · ${t('team.feesOn')}`}
                    </span>
                  </div>
                  <span className="rounded-full bg-ok-bg px-2.5 py-[3px] text-[12px] font-semibold text-ok">
                    {t('team.active')}
                  </span>
                  {!isOwner && <Icon name="chevron" size={18} className="shrink-0 text-muted" />}
                </>
              );
              return (
                <li key={m.id} className="border-t border-border">
                  {isOwner ? (
                    <div className="flex min-h-16 items-center gap-3">{body}</div>
                  ) : (
                    <Link
                      href={`/team/${m.id}`}
                      aria-label={`${m.user.name ?? ''}, ${t(`roles.${m.role}`)}. ${t('team.edit')}`}
                      className="flex min-h-16 items-center gap-3"
                    >
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
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

        <section
          aria-labelledby="team-matrix"
          className="flex min-w-0 flex-col rounded-card border border-border bg-surface px-5 pt-4 pb-2"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2.5">
            <h2 id="team-matrix" className="text-[16px] font-semibold">
              {t('team.matrix.title')}
            </h2>
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <Icon name="lock" size={14} className="text-lock-text" />
              {t('team.matrix.lockNote')}
            </span>
          </div>
          <div className="-mx-5 overflow-x-auto px-5" tabIndex={0} role="region" aria-labelledby="team-matrix">
            <table className="w-full min-w-[460px] border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {t('team.matrix.permission')}
                  </th>
                  {roles.map((r) => (
                    <th key={r} scope="col" className="w-[17%] py-2 text-center font-semibold">
                      {t(`roles.${r}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row) => (
                  <tr key={row.key} className="border-t border-border">
                    <th
                      scope="row"
                      className={`py-2.5 pr-3 text-left leading-snug ${row.strong ? 'font-semibold' : 'font-normal'}`}
                    >
                      {t(`team.matrix.rows.${row.key}`)}
                    </th>
                    {row.cells.map((c, i) => (
                      <td key={roles[i]} className="py-2.5 text-center text-[13px]">
                        <span className="inline-flex items-center justify-center">{cell(c)}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border py-3 text-[13px] text-muted">{t('team.matrix.adjustable')}</p>
        </section>
      </div>

      <div className="flex max-w-[760px] flex-col items-start gap-3 rounded-[14px] bg-accent-soft px-[18px] py-4 text-[14px] sm:flex-row">
        <Icon name="shield" size={20} className="mt-0.5 shrink-0 text-accent" />
        <span className="flex-1">{t('team.adminNote')}</span>
        <Link href="/team/activity" className="flex h-11 shrink-0 items-center font-semibold text-accent underline">
          {t('team.activityLink')}
        </Link>
      </div>
    </div>
  );
}
