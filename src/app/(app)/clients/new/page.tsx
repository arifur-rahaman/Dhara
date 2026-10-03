import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { ClientForm } from '@/features/clients/client-form';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('client');
  return { title: t('newTitle') };
}

export default async function NewClientPage() {
  const ctx = await requireCtx();
  if (!can.createClient(ctx)) notFound();
  const t = await getTranslations('client');
  return (
    <div className="flex max-w-[520px] flex-col gap-3">
      <SubpageHeader title={t('newTitle')} backHref="/clients" />
      <ClientForm mode="create" showContact={can.editClientContact(ctx)} />
    </div>
  );
}
