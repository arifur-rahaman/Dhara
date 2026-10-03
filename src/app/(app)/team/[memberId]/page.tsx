import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isUuid } from '@/lib/ids';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { MemberForm, RemoveMemberForm } from './member-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('team');
  return { title: t('editTitle') };
}

/** One member's role and adjustable rules (P3 scope, P9 fees). Owner only (P10). */
export default async function MemberPage({ params }: PageProps<'/team/[memberId]'>) {
  const ctx = await requireCtx();
  if (!can.manageTeam(ctx)) notFound();
  const { memberId } = await params;
  if (!isUuid(memberId)) notFound();
  const member = await withTenant(scopeOf(ctx), (tx) =>
    tx.membership.findFirst({
      where: { id: memberId, chamberId: ctx.chamberId, status: 'active' },
      include: { user: { select: { name: true } } },
    }),
  );
  if (!member || member.role === 'owner') notFound();
  const t = await getTranslations('team');

  return (
    <div className="flex max-w-[480px] flex-col gap-4">
      <SubpageHeader title={member.user.name ?? t('editTitle')} backHref="/team" />
      <MemberForm
        member={{
          id: member.id,
          role: member.role as 'associate' | 'munshi' | 'staff',
          caseScope: member.caseScope,
          canSeeFees: member.canSeeFees,
        }}
      />
      <RemoveMemberForm memberId={member.id} name={member.user.name ?? ''} />
    </div>
  );
}
