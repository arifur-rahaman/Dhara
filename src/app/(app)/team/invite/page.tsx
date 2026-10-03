import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { InviteForm } from './invite-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('team');
  return { title: t('inviteTitle') };
}

export default async function InvitePage() {
  const ctx = await requireCtx();
  if (!can.inviteMember(ctx)) notFound();
  const t = await getTranslations('team');
  return (
    <div className="flex max-w-[480px] flex-col gap-4">
      <SubpageHeader title={t('inviteTitle')} backHref="/team" />
      <InviteForm />
    </div>
  );
}
